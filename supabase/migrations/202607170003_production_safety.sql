-- Production safety: verifiable idempotency, tenant-safe stock reads, immutable
-- posted documents, service sales and complete multi-currency transfer lines.

alter table journal_entries
  add column if not exists operation_payload jsonb not null default '{}'::jsonb;

insert into ledger_accounts(household_id, code, name, account_type, system)
select id, 'fx_gain', 'Gains de change', 'income', true from households
on conflict(household_id, code) do nothing;

insert into ledger_accounts(household_id, code, name, account_type, system)
select id, 'fx_loss', 'Pertes de change', 'operating_expense', true from households
on conflict(household_id, code) do nothing;

create or replace function install_household_fx_accounts()
returns trigger language plpgsql set search_path=public as $$
begin
  insert into ledger_accounts(household_id,code,name,account_type,system) values
    (new.id,'fx_gain','Gains de change','income',true),
    (new.id,'fx_loss','Pertes de change','operating_expense',true)
  on conflict(household_id,code) do nothing;
  return new;
end $$;

drop trigger if exists households_install_fx_accounts on households;
create trigger households_install_fx_accounts
after insert on households for each row execute function install_household_fx_accounts();

alter table sales
  add constraint sales_contact_same_household
  foreign key(household_id,contact_id) references contacts(household_id,id);
alter table purchases
  add constraint purchases_supplier_same_household
  foreign key(household_id,supplier_id) references contacts(household_id,id);
alter table expenses
  add constraint expenses_supplier_same_household
  foreign key(household_id,supplier_id) references contacts(household_id,id);
alter table payments
  add constraint payments_contact_same_household
  foreign key(household_id,contact_id) references contacts(household_id,id);

create or replace function current_stock_balance(
  p_household_id uuid,
  p_product_id uuid
) returns table(
  quantity numeric,
  value_base numeric,
  weighted_unit_cost_base numeric
) language plpgsql stable security definer set search_path=public as $$
begin
  if not is_household_member(p_household_id) then
    raise exception 'not allowed';
  end if;
  if not exists(
    select 1 from products
    where household_id=p_household_id and id=p_product_id
  ) then
    raise exception 'product not found';
  end if;

  return query
  select
    coalesce(sum(sm.quantity),0)::numeric(20,4),
    coalesce(sum(sm.quantity * sm.unit_cost_base),0)::numeric(20,4),
    case
      when coalesce(sum(sm.quantity),0) > 0
        then round(sum(sm.quantity * sm.unit_cost_base) / sum(sm.quantity),4)
      else 0
    end::numeric(20,4)
  from stock_movements sm
  where sm.household_id=p_household_id and sm.product_id=p_product_id;
end $$;

create or replace function prevent_posted_document_changes()
returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(current_setting('app.allow_financial_document_write', true),'') = 'on' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='INSERT' then
    if new.status::text='posted' then
      raise exception 'posted financial documents must be created by controlled RPC';
    end if;
    return new;
  elsif tg_op='UPDATE' then
    if old.status::text='posted' then raise exception 'posted financial documents are immutable'; end if;
    return new;
  else
    if old.status::text='posted' then raise exception 'posted financial documents are immutable'; end if;
    return old;
  end if;
end $$;

drop trigger if exists payments_no_direct_posted_write on payments;
create trigger payments_no_direct_posted_write
before insert or update or delete on payments
for each row execute function prevent_posted_document_changes();

drop trigger if exists expenses_no_direct_posted_write on expenses;
create trigger expenses_no_direct_posted_write
before insert or update or delete on expenses
for each row execute function prevent_posted_document_changes();

drop trigger if exists purchases_no_direct_posted_write on purchases;
create trigger purchases_no_direct_posted_write
before insert or update or delete on purchases
for each row execute function prevent_posted_document_changes();

create or replace function prevent_linked_sale_changes()
returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(current_setting('app.allow_financial_document_write', true),'') <> 'on'
     and old.journal_entry_id is not null then
    raise exception 'posted sale documents are immutable outside controlled RPCs';
  end if;
  return coalesce(new,old);
end $$;

drop trigger if exists sales_no_direct_linked_write on sales;
create trigger sales_no_direct_linked_write
before update or delete on sales
for each row execute function prevent_linked_sale_changes();

create or replace function reject_direct_posted_entry()
returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(current_setting('app.allow_posted_journal_insert',true),'')='on' then
    return new;
  end if;
  if (tg_op='INSERT' and new.status<>'draft')
     or (tg_op='UPDATE' and new.status is distinct from old.status) then
    raise exception 'journal status changes must use controlled RPCs';
  end if;
  return new;
end $$;

create or replace function prevent_finalized_entry_changes()
returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(current_setting('app.allow_posted_journal_insert',true),'')='on' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if old.status in ('posted','reversed') then
    raise exception 'finalized journal entries are immutable';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists journal_entries_no_finalized_changes on journal_entries;
create trigger journal_entries_no_finalized_changes
before update or delete on journal_entries
for each row execute function prevent_finalized_entry_changes();

create or replace function reverse_journal_entry(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  original journal_entries%rowtype;
  new_id uuid := gen_random_uuid();
begin
  if nullif(trim(p_reason),'') is null then
    raise exception 'reversal reason required';
  end if;
  select * into original
  from journal_entries
  where id=p_entry and status='posted'
  for update;
  if not found or not can_write_household(original.household_id) then
    raise exception 'not allowed';
  end if;

  perform set_config('app.allow_posted_journal_insert','on',true);
  insert into journal_entries(
    id, household_id, number, type, entry_date, status, description,
    activity_id, reversal_of, reversal_reason, created_by, posted_at,
    operation_payload
  ) values(
    new_id, original.household_id, original.number||'-REV', 'reversal',
    current_date, 'posted', 'Annulation: '||p_reason, original.activity_id,
    original.id, p_reason, auth.uid(), now(),
    jsonb_build_object('reversal_of', original.id, 'reason', p_reason)
  );
  insert into journal_lines(
    household_id, journal_entry_id, ledger_account_id, cash_account_id,
    debit_base, credit_base, currency, source_amount, exchange_rate
  )
  select
    household_id, new_id, ledger_account_id, cash_account_id,
    credit_base, debit_base, currency, source_amount, exchange_rate
  from journal_lines
  where journal_entry_id=original.id;
  update journal_entries set status='reversed' where id=original.id;
  insert into audit_logs(
    household_id, actor_id, action, entity, entity_id, metadata
  ) values(
    original.household_id, auth.uid(), 'reverse', 'journal_entry', p_entry,
    jsonb_build_object('reason',p_reason,'reversal_entry_id',new_id)
  );
  return new_id;
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
  payload jsonb := coalesce(p_payload,'{}'::jsonb);
  fingerprint jsonb;
  operation_date date := coalesce(nullif(payload->>'operation_date','')::date,current_date);
  base_amount numeric(20,4) := round(p_amount_source * p_exchange_rate,4);
  entry_id uuid := gen_random_uuid();
  existing_entry_id uuid;
  existing_payload jsonb;
  activity uuid;
  n text;
  source_cash uuid := nullif(payload->>'source_cash_account_id','')::uuid;
  dest_cash uuid := nullif(payload->>'destination_cash_account_id','')::uuid;
  source_ledger uuid;
  dest_ledger uuid;
  source_cash_currency text;
  dest_cash_currency text;
  product uuid := nullif(payload->>'product_id','')::uuid;
  product_type text;
  product_activity uuid;
  loc uuid := nullif(payload->>'inventory_location_id','')::uuid;
  sale uuid := nullif(payload->>'sale_id','')::uuid;
  goal uuid := nullif(payload->>'savings_goal_id','')::uuid;
  category uuid := nullif(payload->>'category_id','')::uuid;
  inventory_account uuid;
  cogs_account uuid;
  sales_account uuid;
  receivable_account uuid;
  equity_account uuid;
  opex_account uuid;
  family_account uuid;
  fx_gain_account uuid;
  fx_loss_account uuid;
  qty numeric(20,4) := coalesce(nullif(payload->>'quantity','')::numeric,1);
  unit_price numeric(20,4);
  unit_cost numeric(20,4) := 0;
  stock_qty numeric(20,4);
  stock_value numeric(20,4);
  cogs_base numeric(20,4) := 0;
  cogs_source numeric(20,4) := 0;
  paid numeric(20,4);
  sale_total numeric(20,4);
  sale_total_base numeric(20,4);
  sale_currency text;
  already_paid numeric(20,4);
  remaining numeric(20,4);
  new_status sale_status;
  fees numeric(20,4) := coalesce(nullif(payload->>'fees_source','')::numeric,0);
  fees_base numeric(20,4) := round(coalesce(nullif(payload->>'fees_source','')::numeric,0) * p_exchange_rate,4);
  destination_amount numeric(20,4) := coalesce(nullif(payload->>'destination_amount_source','')::numeric,p_amount_source);
  destination_currency text := coalesce(nullif(payload->>'destination_currency',''),p_currency);
  destination_rate numeric(20,8) := coalesce(nullif(payload->>'destination_exchange_rate','')::numeric,p_exchange_rate);
  destination_base numeric(20,4);
  fx_difference numeric(20,4);
begin
  if not can_operate_household(p_household_id) then raise exception 'not allowed'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
  if nullif(trim(p_description),'') is null then raise exception 'description is required'; end if;
  if p_amount_source <= 0 or p_exchange_rate <= 0 or qty <= 0 or fees < 0 then
    raise exception 'amount, quantity and exchange rate must be positive';
  end if;
  if destination_amount <= 0 or destination_rate <= 0 then
    raise exception 'destination amount and exchange rate must be positive';
  end if;
  if not exists(
    select 1 from currencies
    where household_id=p_household_id and code=p_currency and active
  ) then raise exception 'source currency is invalid'; end if;
  if not exists(
    select 1 from currencies
    where household_id=p_household_id and code=destination_currency and active
  ) then raise exception 'destination currency is invalid'; end if;

  fingerprint := jsonb_strip_nulls(jsonb_build_object(
    'operation_type',p_operation_type,
    'amount_source',p_amount_source,
    'currency',p_currency,
    'exchange_rate',p_exchange_rate,
    'description',trim(p_description),
    'activity_code',nullif(p_activity_code,''),
    'payload',payload
  ));
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':'||p_idempotency_key,0));
  select id,operation_payload into existing_entry_id,existing_payload
  from journal_entries
  where household_id=p_household_id and idempotency_key=p_idempotency_key
  for update;
  if existing_entry_id is not null then
    if existing_payload=fingerprint then return existing_entry_id; end if;
    raise exception 'idempotency key conflict for household';
  end if;

  if nullif(p_activity_code,'') is not null then
    select id into activity from activities
    where household_id=p_household_id and code=p_activity_code and active;
    if activity is null then raise exception 'activity is invalid or inactive'; end if;
  end if;
  if p_operation_type in ('cash_sale','credit_sale','stock_purchase') and activity is null then
    raise exception 'activity is required';
  end if;

  if source_cash is not null then
    select ledger_account_id,currency into source_ledger,source_cash_currency
    from cash_accounts
    where household_id=p_household_id and id=source_cash and active;
    if source_ledger is null then raise exception 'source cash account is invalid'; end if;
  end if;
  if dest_cash is not null then
    select ledger_account_id,currency into dest_ledger,dest_cash_currency
    from cash_accounts
    where household_id=p_household_id and id=dest_cash and active;
    if dest_ledger is null then raise exception 'destination cash account is invalid'; end if;
  end if;
  if source_cash is not null and source_cash_currency<>p_currency then
    raise exception 'source account currency does not match operation currency';
  end if;
  if dest_cash is not null and dest_cash_currency<>destination_currency then
    raise exception 'destination account currency does not match destination currency';
  end if;

  if product is not null then
    select type,activity_id into product_type,product_activity
    from products
    where household_id=p_household_id and id=product and active;
    if product_type is null then raise exception 'product is invalid'; end if;
    if activity is distinct from product_activity then
      raise exception 'product does not belong to activity';
    end if;
  end if;
  if loc is null then
    select id into loc from inventory_locations
    where household_id=p_household_id and primary_location and active
    order by name limit 1;
  elsif not exists(
    select 1 from inventory_locations
    where household_id=p_household_id and id=loc and active
  ) then raise exception 'inventory location is invalid'; end if;

  select id into inventory_account from ledger_accounts where household_id=p_household_id and code='inventory';
  select id into receivable_account from ledger_accounts where household_id=p_household_id and code='receivable';
  select id into sales_account from ledger_accounts where household_id=p_household_id and code='sales';
  select id into cogs_account from ledger_accounts where household_id=p_household_id and code='cogs';
  select id into opex_account from ledger_accounts where household_id=p_household_id and code='opex';
  select id into family_account from ledger_accounts where household_id=p_household_id and code='family';
  select id into equity_account from ledger_accounts where household_id=p_household_id and code='equity';
  select id into fx_gain_account from ledger_accounts where household_id=p_household_id and code='fx_gain';
  select id into fx_loss_account from ledger_accounts where household_id=p_household_id and code='fx_loss';

  n := upper(substr(p_operation_type,1,3))||'-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
  insert into journal_entries(
    id,household_id,number,type,entry_date,status,description,activity_id,
    created_by,operation_payload
  ) values(
    entry_id,p_household_id,n,p_operation_type,operation_date,'draft',
    trim(p_description),activity,auth.uid(),fingerprint
  );
  perform set_config('app.allow_financial_document_write','on',true);

  if p_operation_type in ('cash_sale','credit_sale') then
    if product is null then raise exception 'product is required for sales'; end if;
    if p_operation_type='cash_sale' and source_cash is null then
      raise exception 'cash sale requires a cash account';
    end if;
    unit_price := round(p_amount_source/qty,4);
    if product_type='physical' then
      if loc is null then raise exception 'inventory location is required'; end if;
      select quantity,value_base,weighted_unit_cost_base
      into stock_qty,stock_value,unit_cost
      from current_stock_balance(p_household_id,product);
      if stock_qty<qty then raise exception 'insufficient stock'; end if;
      cogs_base := round(unit_cost*qty,4);
      cogs_source := round(cogs_base/p_exchange_rate,4);
    end if;
    insert into sales(
      id,household_id,number,activity_id,contact_id,sale_date,status,currency,
      total_source,total_base,due_date,journal_entry_id
    ) values(
      gen_random_uuid(),p_household_id,n,activity,nullif(payload->>'contact_id','')::uuid,
      operation_date,case when p_operation_type='cash_sale' then 'paid'::sale_status else 'confirmed'::sale_status end,
      p_currency,p_amount_source,base_amount,nullif(payload->>'due_date','')::date,entry_id
    ) returning id into sale;
    insert into sale_items(
      household_id,sale_id,product_id,description,quantity,unit_price,unit_cost,
      total_source,total_base
    ) values(
      p_household_id,sale,product,trim(p_description),qty,unit_price,unit_cost,
      p_amount_source,base_amount
    );
    insert into journal_lines(
      household_id,journal_entry_id,ledger_account_id,cash_account_id,
      debit_base,credit_base,currency,source_amount,exchange_rate
    ) values
      (p_household_id,entry_id,case when p_operation_type='cash_sale' then source_ledger else receivable_account end,
       case when p_operation_type='cash_sale' then source_cash else null end,base_amount,0,p_currency,p_amount_source,p_exchange_rate),
      (p_household_id,entry_id,sales_account,null,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
    if product_type='physical' then
      insert into stock_movements(
        household_id,product_id,location_id,type,quantity,unit_cost_base,
        reference_type,reference_id,movement_date
      ) values(p_household_id,product,loc,'sale',-qty,unit_cost,'sale',sale,operation_date);
      insert into journal_lines(
        household_id,journal_entry_id,ledger_account_id,cash_account_id,
        debit_base,credit_base,currency,source_amount,exchange_rate
      ) values
        (p_household_id,entry_id,cogs_account,null,cogs_base,0,p_currency,cogs_source,p_exchange_rate),
        (p_household_id,entry_id,inventory_account,null,0,cogs_base,p_currency,cogs_source,p_exchange_rate);
    end if;

  elsif p_operation_type='payment' then
    if sale is null or source_cash is null then raise exception 'payment requires sale_id and cash account'; end if;
    select total_source,total_base,currency,status
    into sale_total,sale_total_base,sale_currency,new_status
    from sales where household_id=p_household_id and id=sale for update;
    if sale_total is null then raise exception 'sale not found'; end if;
    if sale_currency<>p_currency then raise exception 'payment currency must match sale currency'; end if;
    if round(sale_total_base/sale_total,8)<>round(p_exchange_rate,8) then
      raise exception 'payment exchange rate must match the frozen sale rate';
    end if;
    select coalesce(sum(balance_applied_source),0) into already_paid
    from payments where household_id=p_household_id and sale_id=sale and status='posted';
    remaining := sale_total-already_paid;
    if p_amount_source>remaining then raise exception 'payment exceeds sale balance'; end if;
    paid := already_paid+p_amount_source;
    new_status := case when paid>=sale_total then 'paid'::sale_status else 'partially_paid'::sale_status end;
    insert into payments(
      household_id,sale_id,cash_account_id,amount_source,balance_applied_source,
      currency,exchange_rate,payment_date,status,journal_entry_id
    ) values(
      p_household_id,sale,source_cash,p_amount_source,p_amount_source,p_currency,
      p_exchange_rate,operation_date,'posted',entry_id
    );
    update sales set status=new_status where household_id=p_household_id and id=sale;
    insert into journal_lines(
      household_id,journal_entry_id,ledger_account_id,cash_account_id,
      debit_base,credit_base,currency,source_amount,exchange_rate
    ) values
      (p_household_id,entry_id,source_ledger,source_cash,base_amount,0,p_currency,p_amount_source,p_exchange_rate),
      (p_household_id,entry_id,receivable_account,null,0,base_amount,p_currency,p_amount_source,p_exchange_rate);

  elsif p_operation_type='stock_purchase' then
    if product is null or product_type<>'physical' or source_cash is null then
      raise exception 'stock purchase requires a physical product and cash account';
    end if;
    if loc is null then raise exception 'inventory location is required'; end if;
    insert into purchases(
      id,household_id,supplier_id,cash_account_id,purchase_date,currency,
      fees_source,total_source,total_base,status,journal_entry_id
    ) values(
      gen_random_uuid(),p_household_id,nullif(payload->>'supplier_id','')::uuid,
      source_cash,operation_date,p_currency,fees,p_amount_source+fees,
      base_amount+fees_base,'posted',entry_id
    ) returning id into sale;
    insert into purchase_items(
      household_id,purchase_id,product_id,quantity,unit_cost,allocated_fees,total_source
    ) values(
      p_household_id,sale,product,qty,round((p_amount_source+fees)/qty,4),fees,p_amount_source+fees
    );
    insert into stock_movements(
      household_id,product_id,location_id,type,quantity,unit_cost_base,
      reference_type,reference_id,movement_date
    ) values(
      p_household_id,product,loc,'purchase',qty,round((base_amount+fees_base)/qty,4),
      'purchase',sale,operation_date
    );
    insert into journal_lines(
      household_id,journal_entry_id,ledger_account_id,cash_account_id,
      debit_base,credit_base,currency,source_amount,exchange_rate
    ) values
      (p_household_id,entry_id,inventory_account,null,base_amount+fees_base,0,p_currency,p_amount_source+fees,p_exchange_rate),
      (p_household_id,entry_id,source_ledger,source_cash,0,base_amount+fees_base,p_currency,p_amount_source+fees,p_exchange_rate);

  elsif p_operation_type in ('operating_expense','family_expense') then
    if source_cash is null or category is null then raise exception 'expense requires category and cash account'; end if;
    if not exists(
      select 1 from categories
      where household_id=p_household_id and id=category and active
        and type=case when p_operation_type='operating_expense' then 'operating_expense' else 'family_expense' end
    ) then raise exception 'expense category does not match operation type'; end if;
    insert into expenses(
      household_id,category_id,cash_account_id,activity_id,scope,expense_date,
      amount_source,amount_base,currency,status,journal_entry_id
    ) values(
      p_household_id,category,source_cash,activity,
      case when p_operation_type='operating_expense' then 'operating' else 'family' end,
      operation_date,p_amount_source,base_amount,p_currency,'posted',entry_id
    );
    insert into journal_lines(
      household_id,journal_entry_id,ledger_account_id,cash_account_id,
      debit_base,credit_base,currency,source_amount,exchange_rate
    ) values
      (p_household_id,entry_id,case when p_operation_type='operating_expense' then opex_account else family_account end,null,base_amount,0,p_currency,p_amount_source,p_exchange_rate),
      (p_household_id,entry_id,source_ledger,source_cash,0,base_amount,p_currency,p_amount_source,p_exchange_rate);

  elsif p_operation_type='transfer' then
    if source_cash is null or dest_cash is null or source_cash=dest_cash then
      raise exception 'transfer requires distinct source and destination cash accounts';
    end if;
    destination_base := round(destination_amount*destination_rate,4);
    fx_difference := round(base_amount-destination_base,4);
    insert into journal_lines(
      household_id,journal_entry_id,ledger_account_id,cash_account_id,
      debit_base,credit_base,currency,source_amount,exchange_rate
    ) values
      (p_household_id,entry_id,dest_ledger,dest_cash,destination_base,0,destination_currency,destination_amount,destination_rate),
      (p_household_id,entry_id,source_ledger,source_cash,0,base_amount+fees_base,p_currency,p_amount_source+fees,p_exchange_rate);
    if fees_base>0 then
      insert into journal_lines(
        household_id,journal_entry_id,ledger_account_id,cash_account_id,
        debit_base,credit_base,currency,source_amount,exchange_rate
      ) values(p_household_id,entry_id,opex_account,null,fees_base,0,p_currency,fees,p_exchange_rate);
    end if;
    if fx_difference>0 then
      insert into journal_lines(
        household_id,journal_entry_id,ledger_account_id,cash_account_id,
        debit_base,credit_base,currency,source_amount,exchange_rate
      ) values(p_household_id,entry_id,fx_loss_account,null,fx_difference,0,p_currency,round(fx_difference/p_exchange_rate,4),p_exchange_rate);
    elsif fx_difference<0 then
      insert into journal_lines(
        household_id,journal_entry_id,ledger_account_id,cash_account_id,
        debit_base,credit_base,currency,source_amount,exchange_rate
      ) values(p_household_id,entry_id,fx_gain_account,null,0,-fx_difference,destination_currency,round(-fx_difference/destination_rate,4),destination_rate);
    end if;

  elsif p_operation_type in ('family_contribution','family_withdrawal','savings_contribution') then
    if source_cash is null then raise exception 'operation requires source cash account'; end if;
    if p_operation_type='savings_contribution' then
      if dest_cash is null or goal is null then
        raise exception 'savings contribution requires destination savings account and goal';
      end if;
      if dest_cash_currency<>p_currency or destination_currency<>p_currency then
        raise exception 'savings contribution requires matching account currencies';
      end if;
      if not exists(
        select 1 from cash_accounts
        where household_id=p_household_id and id=dest_cash and type='savings' and active
      ) then raise exception 'destination must be a savings account'; end if;
      if not exists(
        select 1 from savings_goals
        where household_id=p_household_id and id=goal and status='active' and currency=p_currency
      ) then raise exception 'savings goal is invalid'; end if;
      insert into savings_contributions(
        household_id,savings_goal_id,source_cash_account_id,savings_cash_account_id,
        amount_source,contribution_date,journal_entry_id
      ) values(p_household_id,goal,source_cash,dest_cash,p_amount_source,operation_date,entry_id);
    end if;
    insert into journal_lines(
      household_id,journal_entry_id,ledger_account_id,cash_account_id,
      debit_base,credit_base,currency,source_amount,exchange_rate
    ) values
      (p_household_id,entry_id,
       case when p_operation_type='family_withdrawal' then equity_account when p_operation_type='savings_contribution' then dest_ledger else source_ledger end,
       case when p_operation_type='savings_contribution' then dest_cash when p_operation_type='family_contribution' then source_cash else null end,
       base_amount,0,p_currency,p_amount_source,p_exchange_rate),
      (p_household_id,entry_id,
       case when p_operation_type='family_withdrawal' then source_ledger when p_operation_type='savings_contribution' then source_ledger else equity_account end,
       case when p_operation_type in ('family_withdrawal','savings_contribution') then source_cash else null end,
       0,base_amount,p_currency,p_amount_source,p_exchange_rate);
  else
    raise exception 'unsupported operation type %',p_operation_type;
  end if;

  return post_journal_entry(entry_id,p_idempotency_key);
end $$;

revoke all on function current_stock_balance(uuid,uuid) from public;
grant execute on function current_stock_balance(uuid,uuid) to authenticated;
revoke all on function record_financial_operation(uuid,text,numeric,text,numeric,text,text,text,jsonb) from public;
grant execute on function record_financial_operation(uuid,text,numeric,text,numeric,text,text,text,jsonb) to authenticated;
revoke all on function reverse_journal_entry(uuid,text) from public;
grant execute on function reverse_journal_entry(uuid,text) to authenticated;
