-- Follow-up hardening for explicit operation payloads, household-scoped idempotency,
-- weighted-average inventory costing and cash-account traceability.

alter table payments add column if not exists balance_applied_source numeric(20,4) not null default 0;
alter table payments add constraint payments_not_over_applied check (balance_applied_source >= 0 and balance_applied_source <= amount_source);
alter table journal_lines add column if not exists cash_account_id uuid references cash_accounts(id);
alter table journal_lines add constraint journal_lines_cash_same_household foreign key(household_id,cash_account_id) references cash_accounts(household_id,id);

create or replace function current_stock_balance(p_household_id uuid, p_product_id uuid)
returns table(quantity numeric, value_base numeric, weighted_unit_cost_base numeric)
language sql stable security definer set search_path=public as $$
  select
    coalesce(sum(quantity),0)::numeric(20,4),
    coalesce(sum(quantity * unit_cost_base),0)::numeric(20,4),
    case when coalesce(sum(quantity),0) > 0 then round(sum(quantity * unit_cost_base) / sum(quantity),4) else 0 end::numeric(20,4)
  from stock_movements
  where household_id = p_household_id and product_id = p_product_id;
$$;

create or replace function post_journal_entry(p_entry uuid, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=public as $$
declare h uuid; existing_entry uuid; existing_status journal_status; existing_type text; new_type text; new_payload text; existing_payload text;
begin
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
  select household_id,type,status,coalesce(description,'') into h,new_type,existing_status,new_payload from journal_entries where id=p_entry for update;
  if h is null or not can_write_household(h) then raise exception 'not allowed'; end if;
  select id,status,type,coalesce(description,'') into existing_entry,existing_status,existing_type,existing_payload
  from journal_entries where household_id=h and idempotency_key=p_idempotency_key for update;
  if existing_entry is not null then
    if existing_entry = p_entry or (existing_status = 'posted' and existing_type = new_type and existing_payload = new_payload) then return existing_entry; end if;
    raise exception 'idempotency key conflict for household';
  end if;
  select status into existing_status from journal_entries where id=p_entry;
  if existing_status <> 'draft' then raise exception 'only draft journal entries can be posted'; end if;
  perform assert_entry_can_post(p_entry);
  perform set_config('app.allow_posted_journal_insert','on',true);
  update journal_entries set status='posted', posted_at=now(), idempotency_key=p_idempotency_key where id=p_entry;
  insert into audit_logs(household_id,actor_id,action,entity,entity_id,metadata) values(h,auth.uid(),'post','journal_entry',p_entry,jsonb_build_object('idempotency_key',p_idempotency_key));
  return p_entry;
end $$;

create or replace function record_financial_operation(
  p_household_id uuid,
  p_operation_type text,
  p_amount_source numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_description text,
  p_activity_code text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  base_amount numeric(20,4) := round(p_amount_source * p_exchange_rate,4);
  entry_id uuid := gen_random_uuid(); existing_entry_id uuid; activity uuid; n text;
  source_cash uuid; dest_cash uuid; source_ledger uuid; dest_ledger uuid; product uuid; loc uuid; sale uuid; goal uuid; category uuid;
  inventory_account uuid; cogs_account uuid; sales_account uuid; receivable_account uuid; equity_account uuid; opex_account uuid; family_account uuid; savings_account uuid;
  qty numeric(20,4) := coalesce(nullif(p_payload->>'quantity','')::numeric,1); unit_price numeric(20,4) := p_amount_source; unit_cost numeric(20,4); stock_qty numeric(20,4); stock_value numeric(20,4);
  paid numeric(20,4); sale_total numeric(20,4); already_paid numeric(20,4); remaining numeric(20,4); new_status sale_status; fees numeric(20,4) := coalesce(nullif(p_payload->>'fees_source','')::numeric,0); fees_base numeric(20,4) := round(coalesce(nullif(p_payload->>'fees_source','')::numeric,0) * p_exchange_rate,4);
begin
  if not can_operate_household(p_household_id) then raise exception 'not allowed'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
  select id into existing_entry_id from journal_entries where household_id=p_household_id and idempotency_key=p_idempotency_key for update;
  if existing_entry_id is not null then return existing_entry_id; end if;
  if p_amount_source <= 0 or p_exchange_rate <= 0 or qty <= 0 then raise exception 'amount, quantity and exchange rate must be positive'; end if;

  select id into activity from activities where household_id=p_household_id and code=coalesce(nullif(p_activity_code,''),'IPTV');
  source_cash := nullif(p_payload->>'source_cash_account_id','')::uuid; dest_cash := nullif(p_payload->>'destination_cash_account_id','')::uuid; product := nullif(p_payload->>'product_id','')::uuid; loc := nullif(p_payload->>'inventory_location_id','')::uuid; sale := nullif(p_payload->>'sale_id','')::uuid; goal := nullif(p_payload->>'savings_goal_id','')::uuid; category := nullif(p_payload->>'category_id','')::uuid;
  select ledger_account_id into source_ledger from cash_accounts where household_id=p_household_id and id=source_cash and active;
  if source_cash is not null and source_ledger is null then raise exception 'source cash account is invalid'; end if;
  select ledger_account_id into dest_ledger from cash_accounts where household_id=p_household_id and id=dest_cash and active;
  if dest_cash is not null and dest_ledger is null then raise exception 'destination cash account is invalid'; end if;
  if loc is null then select id into loc from inventory_locations where household_id=p_household_id and primary_location order by name limit 1; end if;
  select id into inventory_account from ledger_accounts where household_id=p_household_id and code='inventory'; select id into receivable_account from ledger_accounts where household_id=p_household_id and code='receivable'; select id into savings_account from ledger_accounts where household_id=p_household_id and code='savings'; select id into sales_account from ledger_accounts where household_id=p_household_id and code='sales'; select id into cogs_account from ledger_accounts where household_id=p_household_id and code='cogs'; select id into opex_account from ledger_accounts where household_id=p_household_id and code='opex'; select id into family_account from ledger_accounts where household_id=p_household_id and code='family'; select id into equity_account from ledger_accounts where household_id=p_household_id and code='equity';
  n := upper(substr(p_operation_type,1,3)) || '-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
  insert into journal_entries(id,household_id,number,type,entry_date,status,description,activity_id,created_by) values(entry_id,p_household_id,n,p_operation_type,coalesce(nullif(p_payload->>'operation_date','')::date,current_date),'draft',p_payload::text,activity,auth.uid());

  if p_operation_type in ('cash_sale','credit_sale') then
    if product is null then raise exception 'product is required for sales'; end if;
    if source_cash is null and p_operation_type='cash_sale' then raise exception 'cash sale requires a cash account'; end if;
    select quantity,value_base,weighted_unit_cost_base into stock_qty,stock_value,unit_cost from current_stock_balance(p_household_id,product);
    if stock_qty < qty then raise exception 'insufficient stock'; end if;
    insert into sales(id,household_id,number,activity_id,contact_id,sale_date,status,currency,total_source,total_base,due_date,journal_entry_id) values(gen_random_uuid(),p_household_id,n,activity,nullif(p_payload->>'contact_id','')::uuid,current_date,case when p_operation_type='cash_sale' then 'paid'::sale_status else 'confirmed'::sale_status end,p_currency,p_amount_source,base_amount,nullif(p_payload->>'due_date','')::date,entry_id) returning id into sale;
    insert into sale_items(household_id,sale_id,product_id,description,quantity,unit_price,unit_cost,total_source,total_base) values(p_household_id,sale,product,p_description,qty,unit_price,unit_cost,p_amount_source,base_amount);
    insert into stock_movements(household_id,product_id,location_id,type,quantity,unit_cost_base,reference_type,reference_id,movement_date) values(p_household_id,product,loc,'sale',-qty,unit_cost,'sale',sale,current_date);
    insert into journal_lines(household_id,journal_entry_id,ledger_account_id,cash_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,case when p_operation_type='cash_sale' then source_ledger else receivable_account end,case when p_operation_type='cash_sale' then source_cash else null end,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,sales_account,null,0,base_amount,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,cogs_account,null,round(unit_cost*qty,4),0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,inventory_account,null,0,round(unit_cost*qty,4),p_currency,p_amount_source,p_exchange_rate);
  elsif p_operation_type='payment' then
    if sale is null or source_cash is null then raise exception 'payment requires sale_id and cash account'; end if;
    select total_source,status into sale_total,new_status from sales where household_id=p_household_id and id=sale for update;
    if sale_total is null then raise exception 'sale not found'; end if;
    select coalesce(sum(amount_source),0) into already_paid from payments where household_id=p_household_id and sale_id=sale and status='posted';
    remaining := sale_total - already_paid;
    if p_amount_source > remaining then raise exception 'payment exceeds sale balance'; end if;
    paid := already_paid + p_amount_source; new_status := case when paid >= sale_total then 'paid'::sale_status else 'partially_paid'::sale_status end;
    insert into payments(household_id,sale_id,cash_account_id,amount_source,balance_applied_source,currency,exchange_rate,payment_date,status,journal_entry_id) values(p_household_id,sale,source_cash,p_amount_source,p_amount_source,p_currency,p_exchange_rate,current_date,'posted',entry_id);
    update sales set status=new_status where household_id=p_household_id and id=sale;
    insert into journal_lines(household_id,journal_entry_id,ledger_account_id,cash_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,source_ledger,source_cash,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,receivable_account,null,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
  elsif p_operation_type='stock_purchase' then
    if product is null or source_cash is null then raise exception 'stock purchase requires product and cash account'; end if;
    insert into purchases(id,household_id,supplier_id,cash_account_id,purchase_date,currency,fees_source,total_source,total_base,status,journal_entry_id) values(gen_random_uuid(),p_household_id,nullif(p_payload->>'supplier_id','')::uuid,source_cash,current_date,p_currency,fees,p_amount_source,base_amount,'posted',entry_id) returning id into sale;
    insert into purchase_items(household_id,purchase_id,product_id,quantity,unit_cost,allocated_fees,total_source) values(p_household_id,sale,product,qty,round((base_amount+fees_base)/qty,4),fees,p_amount_source);
    insert into stock_movements(household_id,product_id,location_id,type,quantity,unit_cost_base,reference_type,reference_id,movement_date) values(p_household_id,product,loc,'purchase',qty,round((base_amount+fees_base)/qty,4),'purchase',sale,current_date);
    insert into journal_lines(household_id,journal_entry_id,ledger_account_id,cash_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,inventory_account,null,base_amount+fees_base,0,p_currency,p_amount_source+fees,p_exchange_rate),(p_household_id,entry_id,source_ledger,source_cash,0,base_amount+fees_base,p_currency,p_amount_source+fees,p_exchange_rate);
  elsif p_operation_type in ('operating_expense','family_expense') then
    if source_cash is null or category is null then raise exception 'expense requires category and cash account'; end if;
    insert into expenses(household_id,category_id,cash_account_id,activity_id,scope,expense_date,amount_source,amount_base,currency,status,journal_entry_id) values(p_household_id,category,source_cash,activity,case when p_operation_type='operating_expense' then 'operating' else 'family' end,current_date,p_amount_source,base_amount,p_currency,'posted',entry_id);
    insert into journal_lines(household_id,journal_entry_id,ledger_account_id,cash_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,case when p_operation_type='operating_expense' then opex_account else family_account end,null,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,source_ledger,source_cash,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
  elsif p_operation_type='transfer' then
    if source_cash is null or dest_cash is null or source_cash=dest_cash then raise exception 'transfer requires distinct source and destination cash accounts'; end if;
    insert into journal_lines(household_id,journal_entry_id,ledger_account_id,cash_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,dest_ledger,dest_cash,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,source_ledger,source_cash,0,base_amount+fees_base,p_currency,p_amount_source+fees,p_exchange_rate);
    if fees_base > 0 then insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values(p_household_id,entry_id,opex_account,fees_base,0,p_currency,fees,p_exchange_rate); end if;
  elsif p_operation_type in ('family_contribution','family_withdrawal','savings_contribution') then
    if source_cash is null then raise exception 'operation requires source cash account'; end if;
    if p_operation_type='savings_contribution' then if dest_cash is null or goal is null then raise exception 'savings contribution requires destination savings account and goal'; end if; insert into savings_contributions(household_id,savings_goal_id,source_cash_account_id,savings_cash_account_id,amount_source,contribution_date,journal_entry_id) values(p_household_id,goal,source_cash,dest_cash,p_amount_source,current_date,entry_id); end if;
    insert into journal_lines(household_id,journal_entry_id,ledger_account_id,cash_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,case when p_operation_type='family_withdrawal' then equity_account when p_operation_type='savings_contribution' then dest_ledger else source_ledger end,case when p_operation_type='savings_contribution' then dest_cash when p_operation_type='family_contribution' then source_cash else null end,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,case when p_operation_type='family_withdrawal' then source_ledger when p_operation_type='savings_contribution' then source_ledger else equity_account end,case when p_operation_type in ('family_withdrawal','savings_contribution') then source_cash else null end,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
  else raise exception 'unsupported operation type %', p_operation_type;
  end if;
  return post_journal_entry(entry_id,p_idempotency_key);
exception when others then raise;
end $$;

revoke all on function record_financial_operation(uuid,text,numeric,text,numeric,text,text,text,jsonb) from public;
grant execute on function record_financial_operation(uuid,text,numeric,text,numeric,text,text,text,jsonb) to authenticated;
revoke all on function current_stock_balance(uuid,uuid) from public;
grant execute on function current_stock_balance(uuid,uuid) to authenticated;

create or replace function get_dashboard_kpis(p_household_id uuid, p_from date default null, p_to date default null, p_activity_id uuid default null)
returns table(revenue numeric,gross_profit numeric,net_profit numeric,family_expenses numeric,savings numeric,cash numeric)
language sql stable security definer set search_path=public as $$
  select
    coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base else 0 end),0),
    coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base when a.account_type='cogs' then l.credit_base-l.debit_base else 0 end),0),
    coalesce(sum(case when a.account_type in ('income','cogs','operating_expense') then l.credit_base-l.debit_base else 0 end),0),
    coalesce(sum(case when a.account_type='family_expense' then l.debit_base-l.credit_base else 0 end),0),
    coalesce(sum(case when l.cash_account_id in (select id from cash_accounts where household_id=p_household_id and type='savings') then l.debit_base-l.credit_base else 0 end),0),
    coalesce(sum(case when l.cash_account_id is not null then l.debit_base-l.credit_base else 0 end),0)
  from journal_lines l
  join journal_entries e on e.id=l.journal_entry_id
  join ledger_accounts a on a.id=l.ledger_account_id
  where l.household_id=p_household_id and is_household_member(p_household_id) and e.status='posted'
    and (p_from is null or e.entry_date >= p_from) and (p_to is null or e.entry_date <= p_to) and (p_activity_id is null or e.activity_id=p_activity_id);
$$;

-- Onboarding must create explicit sellable products/offers so sales cannot post without a product.
create or replace function bootstrap_household(p_household_name text, p_display_name text) returns uuid language plpgsql security definer set search_path=public as $$ declare uid uuid := auth.uid(); h uuid := gen_random_uuid(); cash_usd uuid; cash_cdf uuid; mpesa_usd uuid; mpesa_cdf uuid; bank uuid; savings uuid; begin if uid is null then raise exception 'authentication required'; end if; if exists(select 1 from household_members where user_id=uid and status='active') then raise exception 'user already belongs to a household'; end if; insert into profiles(id,display_name) values(uid,p_display_name) on conflict(id) do update set display_name=excluded.display_name; insert into households(id,name) values(h,p_household_name); insert into household_members(household_id,user_id,role,status,joined_at) values(h,uid,'owner','active',now()); insert into currencies(household_id,code,precision) values(h,'USD',2),(h,'CDF',0); insert into activities(household_id,code,name,type,active,display_order) values(h,'IPTV','Vente IPTV','service',true,1),(h,'MINI_UPS','Vente Mini UPS','retail',true,2),(h,'ANDROID_TV_BOX','Vente Android TV Box','retail',true,3),(h,'BILLIARD','Table de billard','venue',false,4); insert into categories(household_id,type,name) values(h,'operating_expense','Achat marchandises'),(h,'operating_expense','Frais mobile money'),(h,'family_expense','Nourriture'),(h,'family_expense','Transport'),(h,'income','Autre entrée'); insert into ledger_accounts(household_id,code,name,account_type,system) values(h,'cash','Trésorerie','asset',true),(h,'inventory','Stock','asset',true),(h,'receivable','Créances clients','asset',true),(h,'savings','Épargne','asset',true),(h,'sales','Ventes','income',true),(h,'cogs','Coût des ventes','cogs',true),(h,'opex','Dépenses exploitation','operating_expense',true),(h,'family','Dépenses familiales','family_expense',true),(h,'equity','Capital familial','equity',true); select id into cash_usd from ledger_accounts where household_id=h and code='cash'; select id into savings from ledger_accounts where household_id=h and code='savings'; insert into cash_accounts(household_id,ledger_account_id,name,type,currency) values(h,cash_usd,'Caisse USD','cash','USD'),(h,cash_usd,'Caisse CDF','cash','CDF'),(h,cash_usd,'M-Pesa USD','mobile_money','USD'),(h,cash_usd,'M-Pesa CDF','mobile_money','CDF'),(h,cash_usd,'Banque','bank','USD'),(h,savings,'Épargne','savings','USD'); insert into inventory_locations(household_id,name,primary_location) values(h,'Principal',true); insert into products(household_id,activity_id,type,sku,name,suggested_price,indicative_cost,low_stock_threshold) select h,a.id,'service','IPTV-STD','Offre IPTV standard',10,0,0 from activities a where a.household_id=h and a.code='IPTV'; insert into products(household_id,activity_id,type,sku,name,suggested_price,indicative_cost,low_stock_threshold) select h,a.id,'physical','MINI-UPS','Mini UPS',25,0,2 from activities a where a.household_id=h and a.code='MINI_UPS'; insert into products(household_id,activity_id,type,sku,name,suggested_price,indicative_cost,low_stock_threshold) select h,a.id,'physical','ATV-BOX','Android TV Box',45,0,1 from activities a where a.household_id=h and a.code='ANDROID_TV_BOX'; insert into audit_logs(household_id,actor_id,action,entity,entity_id) values(h,uid,'bootstrap','household',h); return h; end $$;

