create extension if not exists pgcrypto;
create type household_role as enum ('owner','manager','operator','reader');
create type journal_status as enum ('draft','posted','reversed');
create type sale_status as enum ('draft','confirmed','partially_paid','paid','overdue','cancelled');
create type entity_status as enum ('active','inactive','archived');

create table profiles(id uuid primary key references auth.users(id), display_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table households(id uuid primary key default gen_random_uuid(), name text not null, base_currency text not null default 'USD', locale text not null default 'fr-CD', timezone text not null default 'Africa/Kinshasa', created_at timestamptz not null default now());
create table household_members(household_id uuid references households(id), user_id uuid references auth.users(id), role household_role not null, status text not null default 'active', invited_at timestamptz, joined_at timestamptz default now(), primary key(household_id,user_id));
create table invitations(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), email text not null, role household_role not null, status text not null default 'pending', created_at timestamptz not null default now());
create table audit_logs(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), actor_id uuid references auth.users(id), action text not null, entity text not null, entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now());

create table activities(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), code text not null, name text not null, type text not null check(type in ('service','retail','venue','other')), active boolean not null default true, color text, display_order int not null default 0, unique(household_id,code));
create table categories(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), type text not null check(type in ('income','operating_expense','family_expense','other')), name text not null, parent_id uuid references categories(id), active boolean not null default true, unique(household_id,type,name));
create table contacts(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), name text not null, is_customer boolean not null default false, is_supplier boolean not null default false, phone text, active boolean not null default true);
create table products(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), activity_id uuid not null references activities(id), type text not null, sku text, name text not null, suggested_price numeric(20,4), indicative_cost numeric(20,4), low_stock_threshold numeric(20,4) not null default 0, active boolean not null default true, unique(household_id,sku));
create table iptv_plans(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), name text not null, duration_days int not null, price numeric(20,4) not null, currency text not null, active boolean not null default true);
create table currencies(household_id uuid not null references households(id), code text not null, precision int not null default 2, active boolean not null default true, primary key(household_id,code));
create table exchange_rates(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), source_currency text not null, target_currency text not null, rate numeric(20,8) not null check(rate > 0), rate_date date not null, source text not null default 'manual', unique(household_id,source_currency,target_currency,rate_date));

create table ledger_accounts(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), code text not null, name text not null, account_type text not null check(account_type in ('asset','liability','equity','income','cogs','operating_expense','family_expense')), parent_id uuid references ledger_accounts(id), system boolean not null default false, unique(household_id,code));
create table cash_accounts(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), ledger_account_id uuid not null references ledger_accounts(id), name text not null, type text not null, currency text not null, active boolean not null default true);
create table document_sequences(household_id uuid not null references households(id), document_type text not null, year int not null, counter int not null default 0, primary key(household_id,document_type,year));
create table journal_entries(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), number text not null, type text not null, entry_date date not null, status journal_status not null default 'draft', description text, activity_id uuid references activities(id), idempotency_key text, reversal_of uuid references journal_entries(id), reversal_reason text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), posted_at timestamptz, unique(household_id,number), unique(household_id,idempotency_key));
create table journal_lines(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), journal_entry_id uuid not null references journal_entries(id), ledger_account_id uuid not null references ledger_accounts(id), debit_base numeric(20,4) not null default 0, credit_base numeric(20,4) not null default 0, currency text not null, source_amount numeric(20,4) not null, exchange_rate numeric(20,8) not null check(exchange_rate > 0), check(debit_base >= 0 and credit_base >= 0 and debit_base * credit_base = 0 and (debit_base + credit_base) > 0));
create table reconciliations(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), cash_account_id uuid not null references cash_accounts(id), period_start date not null, period_end date not null, statement_balance numeric(20,4) not null, difference numeric(20,4) not null, status text not null default 'draft');

create table sales(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), number text not null, activity_id uuid not null references activities(id), contact_id uuid references contacts(id), sale_date date not null, status sale_status not null default 'draft', currency text not null, total_source numeric(20,4) not null default 0, total_base numeric(20,4) not null default 0, due_date date, journal_entry_id uuid references journal_entries(id), unique(household_id,number));
create table sale_items(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), sale_id uuid not null references sales(id), product_id uuid references products(id), description text not null, quantity numeric(20,4) not null check(quantity > 0), unit_price numeric(20,4) not null, discount numeric(20,4) not null default 0, tax numeric(20,4) not null default 0, unit_cost numeric(20,4) not null default 0, total_source numeric(20,4) not null, total_base numeric(20,4) not null);
create table payments(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), sale_id uuid references sales(id), contact_id uuid references contacts(id), cash_account_id uuid not null references cash_accounts(id), amount_source numeric(20,4) not null, currency text not null, exchange_rate numeric(20,8) not null, payment_date date not null, status journal_status not null default 'draft', journal_entry_id uuid references journal_entries(id));
create table iptv_subscriptions(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), contact_id uuid references contacts(id), plan_id uuid references iptv_plans(id), customer_identifier text not null, activation_date date not null, expiration_date date not null, status text not null, sale_id uuid references sales(id));
create table billiard_sessions(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), started_at timestamptz, ended_at timestamptz, games_count numeric(20,4), duration_minutes int, rate numeric(20,4) not null, sale_id uuid references sales(id));

create table expenses(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), category_id uuid not null references categories(id), scope text not null check(scope in ('operating','family')), supplier_id uuid references contacts(id), cash_account_id uuid not null references cash_accounts(id), activity_id uuid references activities(id), expense_date date not null, amount_source numeric(20,4) not null, amount_base numeric(20,4) not null, currency text not null, status journal_status not null default 'draft', journal_entry_id uuid references journal_entries(id));
create table purchases(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), supplier_id uuid references contacts(id), cash_account_id uuid not null references cash_accounts(id), purchase_date date not null, currency text not null, fees_source numeric(20,4) not null default 0, total_source numeric(20,4) not null default 0, total_base numeric(20,4) not null default 0, status journal_status not null default 'draft', journal_entry_id uuid references journal_entries(id));
create table purchase_items(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), purchase_id uuid not null references purchases(id), product_id uuid not null references products(id), quantity numeric(20,4) not null check(quantity > 0), unit_cost numeric(20,4) not null, allocated_fees numeric(20,4) not null default 0, total_source numeric(20,4) not null);
create table recurring_templates(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), type text not null, frequency text not null, next_date date not null, payload jsonb not null);

create table inventory_locations(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), name text not null, primary_location boolean not null default false, active boolean not null default true);
create table stock_movements(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), product_id uuid not null references products(id), location_id uuid not null references inventory_locations(id), type text not null, quantity numeric(20,4) not null, unit_cost_base numeric(20,4) not null, reference_type text, reference_id uuid, movement_date date not null);
create table inventory_counts(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), location_id uuid not null references inventory_locations(id), status text not null default 'draft', count_date date not null, responsible_id uuid references auth.users(id));
create table inventory_count_lines(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), inventory_count_id uuid not null references inventory_counts(id), product_id uuid not null references products(id), theoretical_quantity numeric(20,4) not null, counted_quantity numeric(20,4) not null, difference numeric(20,4) not null);

create table savings_goals(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), name text not null, target_amount numeric(20,4) not null, currency text not null, target_date date, priority int not null default 1, status entity_status not null default 'active');
create table savings_contributions(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), savings_goal_id uuid not null references savings_goals(id), source_cash_account_id uuid not null references cash_accounts(id), savings_cash_account_id uuid not null references cash_accounts(id), amount_source numeric(20,4) not null, contribution_date date not null, journal_entry_id uuid references journal_entries(id));
create table budgets(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), period_month date not null, scope text not null, currency text not null, unique(household_id,period_month,scope));
create table budget_lines(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), budget_id uuid not null references budgets(id), category_id uuid references categories(id), activity_id uuid references activities(id), amount numeric(20,4) not null, warn_threshold numeric(5,2) not null default 80, block_threshold numeric(5,2) not null default 100);
create table attachments(id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), bucket_path text not null, mime_type text not null, size_bytes bigint not null, sha256 text not null, entity text not null, entity_id uuid not null, created_at timestamptz not null default now());

alter table profiles enable row level security; alter table households enable row level security; alter table household_members enable row level security; alter table invitations enable row level security; alter table audit_logs enable row level security; alter table activities enable row level security; alter table categories enable row level security; alter table contacts enable row level security; alter table products enable row level security; alter table iptv_plans enable row level security; alter table currencies enable row level security; alter table exchange_rates enable row level security; alter table ledger_accounts enable row level security; alter table cash_accounts enable row level security; alter table document_sequences enable row level security; alter table journal_entries enable row level security; alter table journal_lines enable row level security; alter table reconciliations enable row level security; alter table sales enable row level security; alter table sale_items enable row level security; alter table payments enable row level security; alter table iptv_subscriptions enable row level security; alter table billiard_sessions enable row level security; alter table expenses enable row level security; alter table purchases enable row level security; alter table purchase_items enable row level security; alter table recurring_templates enable row level security; alter table inventory_locations enable row level security; alter table stock_movements enable row level security; alter table inventory_counts enable row level security; alter table inventory_count_lines enable row level security; alter table savings_goals enable row level security; alter table savings_contributions enable row level security; alter table budgets enable row level security; alter table budget_lines enable row level security; alter table attachments enable row level security;

create function is_household_member(h uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from household_members m where m.household_id=h and m.user_id=auth.uid() and m.status='active') $$;
create function household_role(h uuid) returns household_role language sql stable security definer set search_path=public as $$ select role from household_members m where m.household_id=h and m.user_id=auth.uid() and m.status='active' limit 1 $$;
create function can_write_household(h uuid) returns boolean language sql stable security definer set search_path=public as $$ select household_role(h) in ('owner','manager','operator') $$;

create policy profile_self on profiles using (id=auth.uid()) with check (id=auth.uid());
create policy household_select on households for select using (is_household_member(id));
create policy member_select on household_members for select using (is_household_member(household_id));

-- generated policies for all household-owned tables
create policy invitations_read on invitations for select using (is_household_member(household_id)); create policy invitations_write on invitations for all using (household_role(household_id) in ('owner','manager')) with check (household_role(household_id) in ('owner','manager'));
create policy audit_read on audit_logs for select using (household_role(household_id)='owner');

create function install_household_policy(t regclass) returns void language plpgsql as $$ begin execute format('create policy %I_select on %s for select using (is_household_member(household_id))', t::text||'_member', t); execute format('create policy %I_write on %s for all using (can_write_household(household_id)) with check (can_write_household(household_id))', t::text||'_writer', t); end $$;
select install_household_policy(x) from unnest(array['activities','categories','contacts','products','iptv_plans','currencies','exchange_rates','ledger_accounts','cash_accounts','document_sequences','journal_entries','journal_lines','reconciliations','sales','sale_items','payments','iptv_subscriptions','billiard_sessions','expenses','purchases','purchase_items','recurring_templates','inventory_locations','stock_movements','inventory_counts','inventory_count_lines','savings_goals','savings_contributions','budgets','budget_lines','attachments']::regclass[]) x;
drop function install_household_policy(regclass);

create function prevent_posted_line_changes() returns trigger language plpgsql as $$ begin if exists(select 1 from journal_entries e where e.id=coalesce(old.journal_entry_id,new.journal_entry_id) and e.status in ('posted','reversed')) then raise exception 'posted journal lines are immutable'; end if; return coalesce(new,old); end $$;
create trigger journal_lines_no_change before update or delete on journal_lines for each row execute function prevent_posted_line_changes();
create function assert_entry_can_post(p_entry uuid) returns void language plpgsql as $$ declare line_count int; debit numeric(20,4); credit numeric(20,4); begin select count(*),coalesce(sum(debit_base),0),coalesce(sum(credit_base),0) into line_count,debit,credit from journal_lines where journal_entry_id=p_entry; if line_count < 2 or debit <> credit then raise exception 'posted journal entry must have at least two balanced lines'; end if; end $$;
create function post_journal_entry(p_entry uuid, p_idempotency_key text) returns uuid language plpgsql security definer set search_path=public as $$ declare h uuid; begin select household_id into h from journal_entries where id=p_entry; if not can_write_household(h) then raise exception 'not allowed'; end if; perform assert_entry_can_post(p_entry); update journal_entries set status='posted', posted_at=now(), idempotency_key=coalesce(idempotency_key,p_idempotency_key) where id=p_entry and status='draft'; return p_entry; end $$;
create function reverse_journal_entry(p_entry uuid, p_reason text) returns uuid language plpgsql security definer set search_path=public as $$ declare original journal_entries%rowtype; new_id uuid := gen_random_uuid(); begin if nullif(trim(p_reason),'') is null then raise exception 'reversal reason required'; end if; select * into original from journal_entries where id=p_entry and status='posted'; if not found or not can_write_household(original.household_id) then raise exception 'not allowed'; end if; insert into journal_entries(id,household_id,number,type,entry_date,status,description,reversal_of,reversal_reason,created_by,posted_at) values(new_id,original.household_id,original.number||'-REV','reversal',current_date,'posted','Annulation: '||p_reason,original.id,p_reason,auth.uid(),now()); insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) select household_id,new_id,ledger_account_id,credit_base,debit_base,currency,source_amount,exchange_rate from journal_lines where journal_entry_id=original.id; update journal_entries set status='reversed' where id=original.id; return new_id; end $$;

create function bootstrap_household(p_household_name text, p_display_name text) returns uuid language plpgsql security definer set search_path=public as $$ declare uid uuid := auth.uid(); h uuid := gen_random_uuid(); cash_usd uuid; cash_cdf uuid; mpesa_usd uuid; mpesa_cdf uuid; bank uuid; savings uuid; begin if uid is null then raise exception 'authentication required'; end if; if exists(select 1 from household_members where user_id=uid and status='active') then raise exception 'user already belongs to a household'; end if; insert into profiles(id,display_name) values(uid,p_display_name) on conflict(id) do update set display_name=excluded.display_name; insert into households(id,name) values(h,p_household_name); insert into household_members(household_id,user_id,role,status,joined_at) values(h,uid,'owner','active',now()); insert into currencies(household_id,code,precision) values(h,'USD',2),(h,'CDF',0); insert into activities(household_id,code,name,type,active,display_order) values(h,'IPTV','Vente IPTV','service',true,1),(h,'MINI_UPS','Vente Mini UPS','retail',true,2),(h,'ANDROID_TV_BOX','Vente Android TV Box','retail',true,3),(h,'BILLIARD','Table de billard','venue',false,4); insert into categories(household_id,type,name) values(h,'operating_expense','Achat marchandises'),(h,'operating_expense','Frais mobile money'),(h,'family_expense','Nourriture'),(h,'family_expense','Transport'),(h,'income','Autre entrée'); insert into ledger_accounts(household_id,code,name,account_type,system) values(h,'cash','Trésorerie','asset',true),(h,'inventory','Stock','asset',true),(h,'receivable','Créances clients','asset',true),(h,'savings','Épargne','asset',true),(h,'sales','Ventes','income',true),(h,'cogs','Coût des ventes','cogs',true),(h,'opex','Dépenses exploitation','operating_expense',true),(h,'family','Dépenses familiales','family_expense',true),(h,'equity','Capital familial','equity',true); select id into cash_usd from ledger_accounts where household_id=h and code='cash'; select id into savings from ledger_accounts where household_id=h and code='savings'; insert into cash_accounts(household_id,ledger_account_id,name,type,currency) values(h,cash_usd,'Caisse USD','cash','USD'),(h,cash_usd,'Caisse CDF','cash','CDF'),(h,cash_usd,'M-Pesa USD','mobile_money','USD'),(h,cash_usd,'M-Pesa CDF','mobile_money','CDF'),(h,cash_usd,'Banque','bank','USD'),(h,savings,'Épargne','savings','USD'); insert into inventory_locations(household_id,name,primary_location) values(h,'Principal',true); insert into audit_logs(household_id,actor_id,action,entity,entity_id) values(h,uid,'bootstrap','household',h); return h; end $$;

create function get_dashboard_kpis(p_household_id uuid) returns table(revenue numeric,gross_profit numeric,net_profit numeric,family_expenses numeric,savings numeric,cash numeric) language sql stable security definer set search_path=public as $$ select coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base else 0 end),0), coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base when a.account_type='cogs' then l.credit_base-l.debit_base else 0 end),0), coalesce(sum(case when a.account_type in ('income','cogs','operating_expense') then l.credit_base-l.debit_base else 0 end),0), coalesce(sum(case when a.account_type='family_expense' then l.debit_base-l.credit_base else 0 end),0), coalesce(sum(case when a.code='savings' then l.debit_base-l.credit_base else 0 end),0), coalesce(sum(case when a.account_type='asset' then l.debit_base-l.credit_base else 0 end),0) from journal_lines l join journal_entries e on e.id=l.journal_entry_id join ledger_accounts a on a.id=l.ledger_account_id where l.household_id=p_household_id and is_household_member(p_household_id) and e.status='posted' $$;

revoke all on function bootstrap_household(text,text) from public; grant execute on function bootstrap_household(text,text) to authenticated;
revoke all on function post_journal_entry(uuid,text) from public; grant execute on function post_journal_entry(uuid,text) to authenticated;
revoke all on function reverse_journal_entry(uuid,text) from public; grant execute on function reverse_journal_entry(uuid,text) to authenticated;
revoke all on function get_dashboard_kpis(uuid) from public; grant execute on function get_dashboard_kpis(uuid) to authenticated;

-- Hardening follow-up: same-household FKs, posted immutability, scoped dashboard and atomic operations.
alter table households add constraint households_id_unique unique(id);
alter table journal_entries add constraint journal_entries_household_id_id_unique unique(household_id,id);
alter table ledger_accounts add constraint ledger_accounts_household_id_id_unique unique(household_id,id);
alter table activities add constraint activities_household_id_id_unique unique(household_id,id);
alter table cash_accounts add constraint cash_accounts_household_id_id_unique unique(household_id,id);

alter table journal_lines add constraint journal_lines_entry_same_household foreign key(household_id,journal_entry_id) references journal_entries(household_id,id);
alter table journal_lines add constraint journal_lines_account_same_household foreign key(household_id,ledger_account_id) references ledger_accounts(household_id,id);
alter table journal_entries add constraint journal_entries_activity_same_household foreign key(household_id,activity_id) references activities(household_id,id);
alter table cash_accounts add constraint cash_accounts_ledger_same_household foreign key(household_id,ledger_account_id) references ledger_accounts(household_id,id);

create or replace function reject_direct_posted_entry() returns trigger language plpgsql as $$
begin
  if new.status = 'posted' and coalesce(current_setting('app.allow_posted_journal_insert', true),'') <> 'on' then
    raise exception 'posted journal entries must be created by controlled RPC';
  end if;
  return new;
end $$;
drop trigger if exists journal_entries_no_direct_posted_insert on journal_entries;
create trigger journal_entries_no_direct_posted_insert before insert on journal_entries for each row execute function reject_direct_posted_entry();

create or replace function post_journal_entry(p_entry uuid, p_idempotency_key text) returns uuid language plpgsql security definer set search_path=public as $$
declare h uuid; affected int;
begin
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
  select household_id into h from journal_entries where id=p_entry for update;
  if h is null or not can_write_household(h) then raise exception 'not allowed'; end if;
  perform assert_entry_can_post(p_entry);
  update journal_entries set status='posted', posted_at=now(), idempotency_key=p_idempotency_key
    where id=p_entry and status='draft' and idempotency_key is null;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'journal entry was not posted exactly once'; end if;
  insert into audit_logs(household_id,actor_id,action,entity,entity_id,metadata) values(h,auth.uid(),'post','journal_entry',p_entry,jsonb_build_object('idempotency_key',p_idempotency_key));
  return p_entry;
end $$;

create or replace function reverse_journal_entry(p_entry uuid, p_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare original journal_entries%rowtype; new_id uuid := gen_random_uuid();
begin
  if nullif(trim(p_reason),'') is null then raise exception 'reversal reason required'; end if;
  select * into original from journal_entries where id=p_entry and status='posted' for update;
  if not found or not can_write_household(original.household_id) then raise exception 'not allowed'; end if;
  perform set_config('app.allow_posted_journal_insert','on',true);
  insert into journal_entries(id,household_id,number,type,entry_date,status,description,reversal_of,reversal_reason,created_by,posted_at)
  values(new_id,original.household_id,original.number||'-REV','reversal',current_date,'posted','Annulation: '||p_reason,original.id,p_reason,auth.uid(),now());
  insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate)
  select household_id,new_id,ledger_account_id,credit_base,debit_base,currency,source_amount,exchange_rate from journal_lines where journal_entry_id=original.id;
  update journal_entries set status='reversed' where id=original.id;
  insert into audit_logs(household_id,actor_id,action,entity,entity_id,metadata) values(original.household_id,auth.uid(),'reverse','journal_entry',p_entry,jsonb_build_object('reason',p_reason,'reversal_entry_id',new_id));
  return new_id;
end $$;

create or replace function get_dashboard_kpis(p_household_id uuid, p_from date default null, p_to date default null, p_activity_id uuid default null)
returns table(revenue numeric,gross_profit numeric,net_profit numeric,family_expenses numeric,savings numeric,cash numeric) language sql stable security definer set search_path=public as $$
 select
  coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base else 0 end),0),
  coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base when a.account_type='cogs' then l.credit_base-l.debit_base else 0 end),0),
  coalesce(sum(case when a.account_type in ('income','cogs','operating_expense') then l.credit_base-l.debit_base else 0 end),0),
  coalesce(sum(case when a.account_type='family_expense' then l.debit_base-l.credit_base else 0 end),0),
  coalesce(sum(case when a.code='savings' then l.debit_base-l.credit_base else 0 end),0),
  coalesce(sum(case when ca.id is not null and ca.type <> 'savings' then l.debit_base-l.credit_base else 0 end),0)
 from journal_lines l
 join journal_entries e on e.household_id=l.household_id and e.id=l.journal_entry_id
 join ledger_accounts a on a.household_id=l.household_id and a.id=l.ledger_account_id
 left join cash_accounts ca on ca.household_id=a.household_id and ca.ledger_account_id=a.id
 where l.household_id=p_household_id and is_household_member(p_household_id) and e.status='posted'
   and (p_from is null or e.entry_date >= p_from) and (p_to is null or e.entry_date <= p_to)
   and (p_activity_id is null or e.activity_id=p_activity_id)
$$;

create or replace function record_financial_operation(p_household_id uuid, p_operation_type text, p_amount_source numeric, p_currency text, p_exchange_rate numeric, p_description text, p_activity_code text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=public as $$
declare base_amount numeric(20,4) := round(p_amount_source * p_exchange_rate,4); entry_id uuid := gen_random_uuid(); activity uuid; debit_code text; credit_code text; n text; debit_account uuid; credit_account uuid;
begin
 if not can_write_household(p_household_id) then raise exception 'not allowed'; end if;
 if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
 if p_amount_source <= 0 or p_exchange_rate <= 0 then raise exception 'amount and exchange rate must be positive'; end if;
 select id into activity from activities where household_id=p_household_id and code=p_activity_code;
 case p_operation_type
  when 'cash_sale' then debit_code='cash'; credit_code='sales';
  when 'credit_sale' then debit_code='receivable'; credit_code='sales';
  when 'payment' then debit_code='cash'; credit_code='receivable';
  when 'stock_purchase' then debit_code='inventory'; credit_code='cash';
  when 'operating_expense' then debit_code='opex'; credit_code='cash';
  when 'family_expense' then debit_code='family'; credit_code='cash';
  when 'transfer' then debit_code='cash'; credit_code='cash';
  when 'family_contribution' then debit_code='cash'; credit_code='equity';
  when 'family_withdrawal' then debit_code='equity'; credit_code='cash';
  when 'savings_contribution' then debit_code='savings'; credit_code='cash';
  else raise exception 'unsupported operation type %', p_operation_type;
 end case;
 select id into debit_account from ledger_accounts where household_id=p_household_id and code=debit_code;
 select id into credit_account from ledger_accounts where household_id=p_household_id and code=credit_code;
 n := upper(substr(p_operation_type,1,3)) || '-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
 insert into journal_entries(id,household_id,number,type,entry_date,status,description,activity_id,created_by)
 values(entry_id,p_household_id,n,p_operation_type,current_date,'draft',p_description,activity,auth.uid());
 insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values
 (p_household_id,entry_id,debit_account,base_amount,0,p_currency,p_amount_source,p_exchange_rate),
 (p_household_id,entry_id,credit_account,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
 perform post_journal_entry(entry_id,p_idempotency_key);
 return entry_id;
end $$;
revoke all on function record_financial_operation(uuid,text,numeric,text,numeric,text,text,text) from public; grant execute on function record_financial_operation(uuid,text,numeric,text,numeric,text,text,text) to authenticated;
revoke all on function get_dashboard_kpis(uuid,date,date,uuid) from public; grant execute on function get_dashboard_kpis(uuid,date,date,uuid) to authenticated;

-- Consolidation pass: block all direct posting transitions, owner-scoped administration,
-- same-household references and vertical business documents for quick operations.
create or replace function reject_direct_posted_entry() returns trigger language plpgsql as $$
begin
  if new.status = 'posted'
     and (tg_op = 'INSERT' or old.status is distinct from 'posted')
     and coalesce(current_setting('app.allow_posted_journal_insert', true),'') <> 'on' then
    raise exception 'posted journal entries must be created by controlled RPC';
  end if;
  return new;
end $$;
drop trigger if exists journal_entries_no_direct_posted_insert on journal_entries;
drop trigger if exists journal_entries_no_direct_posted_transition on journal_entries;
create trigger journal_entries_no_direct_posted_transition before insert or update of status on journal_entries for each row execute function reject_direct_posted_entry();

create or replace function post_journal_entry(p_entry uuid, p_idempotency_key text) returns uuid language plpgsql security definer set search_path=public as $$
declare h uuid; existing_entry uuid; existing_status journal_status;
begin
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
  select id,status into existing_entry,existing_status from journal_entries where idempotency_key=p_idempotency_key for update;
  if existing_entry is not null and existing_entry <> p_entry then raise exception 'idempotency key already used for another operation'; end if;
  if existing_entry = p_entry and existing_status = 'posted' then return p_entry; end if;
  select household_id,status into h,existing_status from journal_entries where id=p_entry for update;
  if h is null or not can_write_household(h) then raise exception 'not allowed'; end if;
  if existing_status <> 'draft' then raise exception 'only draft journal entries can be posted'; end if;
  perform assert_entry_can_post(p_entry);
  perform set_config('app.allow_posted_journal_insert','on',true);
  update journal_entries set status='posted', posted_at=now(), idempotency_key=p_idempotency_key where id=p_entry;
  insert into audit_logs(household_id,actor_id,action,entity,entity_id,metadata) values(h,auth.uid(),'post','journal_entry',p_entry,jsonb_build_object('idempotency_key',p_idempotency_key));
  return p_entry;
end $$;

create or replace function can_manage_household(h uuid) returns boolean language sql stable security definer set search_path=public as $$ select household_role(h) in ('owner','manager') $$;
create or replace function can_operate_household(h uuid) returns boolean language sql stable security definer set search_path=public as $$ select household_role(h) in ('owner','manager','operator') $$;

-- Owner-only administration adapted from the previous hardening pass; operators mutate only through RPCs.
do $$
declare t text;
begin
  foreach t in array array['activities','categories','contacts','products','iptv_plans','currencies','exchange_rates','ledger_accounts','cash_accounts','document_sequences','reconciliations','recurring_templates','inventory_locations','inventory_counts','inventory_count_lines','savings_goals','budgets','budget_lines','attachments','invitations'] loop
    execute format('drop policy if exists %I on %I', t||'_writer', t);
    execute format('drop policy if exists %I on %I', t||'_member_write', t);
    execute format('create policy %I on %I for all using (can_manage_household(household_id)) with check (can_manage_household(household_id))', t||'_manager_write', t);
  end loop;
  foreach t in array array['journal_entries','journal_lines','sales','sale_items','payments','iptv_subscriptions','billiard_sessions','expenses','purchases','purchase_items','stock_movements','savings_contributions'] loop
    execute format('drop policy if exists %I on %I', t||'_writer', t);
    execute format('drop policy if exists %I on %I', t||'_member_write', t);
    execute format('create policy %I on %I for all using (can_manage_household(household_id)) with check (can_manage_household(household_id))', t||'_manager_direct_write', t);
  end loop;
end $$;

alter table contacts add constraint contacts_household_id_id_unique unique(household_id,id);
alter table products add constraint products_household_id_id_unique unique(household_id,id);
alter table categories add constraint categories_household_id_id_unique unique(household_id,id);
alter table inventory_locations add constraint inventory_locations_household_id_id_unique unique(household_id,id);
alter table sales add constraint sales_household_id_id_unique unique(household_id,id);
alter table purchases add constraint purchases_household_id_id_unique unique(household_id,id);
alter table savings_goals add constraint savings_goals_household_id_id_unique unique(household_id,id);
alter table sales add constraint sales_activity_same_household foreign key(household_id,activity_id) references activities(household_id,id);
alter table sale_items add constraint sale_items_sale_same_household foreign key(household_id,sale_id) references sales(household_id,id);
alter table sale_items add constraint sale_items_product_same_household foreign key(household_id,product_id) references products(household_id,id);
alter table payments add constraint payments_sale_same_household foreign key(household_id,sale_id) references sales(household_id,id);
alter table payments add constraint payments_cash_same_household foreign key(household_id,cash_account_id) references cash_accounts(household_id,id);
alter table expenses add constraint expenses_category_same_household foreign key(household_id,category_id) references categories(household_id,id);
alter table expenses add constraint expenses_cash_same_household foreign key(household_id,cash_account_id) references cash_accounts(household_id,id);
alter table purchases add constraint purchases_cash_same_household foreign key(household_id,cash_account_id) references cash_accounts(household_id,id);
alter table purchase_items add constraint purchase_items_purchase_same_household foreign key(household_id,purchase_id) references purchases(household_id,id);
alter table purchase_items add constraint purchase_items_product_same_household foreign key(household_id,product_id) references products(household_id,id);
alter table stock_movements add constraint stock_movements_product_same_household foreign key(household_id,product_id) references products(household_id,id);
alter table stock_movements add constraint stock_movements_location_same_household foreign key(household_id,location_id) references inventory_locations(household_id,id);
alter table savings_contributions add constraint savings_contributions_goal_same_household foreign key(household_id,savings_goal_id) references savings_goals(household_id,id);
alter table savings_contributions add constraint savings_contributions_source_cash_same_household foreign key(household_id,source_cash_account_id) references cash_accounts(household_id,id);
alter table savings_contributions add constraint savings_contributions_savings_cash_same_household foreign key(household_id,savings_cash_account_id) references cash_accounts(household_id,id);

create or replace function record_financial_operation(p_household_id uuid, p_operation_type text, p_amount_source numeric, p_currency text, p_exchange_rate numeric, p_description text, p_activity_code text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=public as $$
declare base_amount numeric(20,4) := round(p_amount_source * p_exchange_rate,4); entry_id uuid := gen_random_uuid(); activity uuid; n text; cash_account uuid; second_cash uuid; savings_cash uuid; loc uuid; prod uuid; goal uuid; sale_id uuid; purchase_id uuid; expense_id uuid; payment_id uuid; debit_account uuid; credit_account uuid; inventory_account uuid; cogs_account uuid; sales_account uuid; receivable_account uuid; equity_account uuid; opex_account uuid; family_account uuid; savings_account uuid; unit_cost numeric(20,4) := round(base_amount * 0.60,4);
begin
 if not can_operate_household(p_household_id) then raise exception 'not allowed'; end if;
 if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
 select id into entry_id from journal_entries where household_id=p_household_id and idempotency_key=p_idempotency_key;
 if entry_id is not null then return entry_id; end if;
 if p_amount_source <= 0 or p_exchange_rate <= 0 then raise exception 'amount and exchange rate must be positive'; end if;
 select id into activity from activities where household_id=p_household_id and code=coalesce(nullif(p_activity_code,''),'IPTV');
 select id into cash_account from cash_accounts where household_id=p_household_id and currency=p_currency and type <> 'savings' order by name limit 1;
 select id into second_cash from cash_accounts where household_id=p_household_id and id <> cash_account and type <> 'savings' order by name limit 1;
 select id into savings_cash from cash_accounts where household_id=p_household_id and type='savings' order by name limit 1;
 select id into loc from inventory_locations where household_id=p_household_id and primary_location order by name limit 1;
 select id into prod from products where household_id=p_household_id and activity_id=activity and active order by name limit 1;
 select id into goal from savings_goals where household_id=p_household_id and status='active' order by priority,id limit 1;
 select id into debit_account from ledger_accounts where household_id=p_household_id and code='cash';
 select id into inventory_account from ledger_accounts where household_id=p_household_id and code='inventory';
 select id into receivable_account from ledger_accounts where household_id=p_household_id and code='receivable';
 select id into savings_account from ledger_accounts where household_id=p_household_id and code='savings';
 select id into sales_account from ledger_accounts where household_id=p_household_id and code='sales';
 select id into cogs_account from ledger_accounts where household_id=p_household_id and code='cogs';
 select id into opex_account from ledger_accounts where household_id=p_household_id and code='opex';
 select id into family_account from ledger_accounts where household_id=p_household_id and code='family';
 select id into equity_account from ledger_accounts where household_id=p_household_id and code='equity';
 n := upper(substr(p_operation_type,1,3)) || '-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
 insert into journal_entries(id,household_id,number,type,entry_date,status,description,activity_id,created_by) values(entry_id,p_household_id,n,p_operation_type,current_date,'draft',p_description,activity,auth.uid());
 if p_operation_type in ('cash_sale','credit_sale') then
   insert into sales(id,household_id,number,activity_id,sale_date,status,currency,total_source,total_base,journal_entry_id) values(gen_random_uuid(),p_household_id,n,activity,current_date,case when p_operation_type='cash_sale' then 'paid'::sale_status else 'confirmed'::sale_status end,p_currency,p_amount_source,base_amount,entry_id) returning id into sale_id;
   insert into sale_items(household_id,sale_id,product_id,description,quantity,unit_price,unit_cost,total_source,total_base) values(p_household_id,sale_id,prod,p_description,1,p_amount_source,unit_cost,p_amount_source,base_amount);
   insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,case when p_operation_type='cash_sale' then debit_account else receivable_account end,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,sales_account,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
   if prod is not null then insert into stock_movements(household_id,product_id,location_id,type,quantity,unit_cost_base,reference_type,reference_id,movement_date) values(p_household_id,prod,loc,'sale',-1,unit_cost,'sale',sale_id,current_date); insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,cogs_account,unit_cost,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,inventory_account,0,unit_cost,p_currency,p_amount_source,p_exchange_rate); end if;
 elsif p_operation_type='payment' then
   insert into payments(household_id,cash_account_id,amount_source,currency,exchange_rate,payment_date,status,journal_entry_id) values(p_household_id,cash_account,p_amount_source,p_currency,p_exchange_rate,current_date,'posted',entry_id) returning id into payment_id;
   insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,debit_account,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,receivable_account,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
 elsif p_operation_type='stock_purchase' then
   insert into purchases(id,household_id,cash_account_id,purchase_date,currency,total_source,total_base,status,journal_entry_id) values(gen_random_uuid(),p_household_id,cash_account,current_date,p_currency,p_amount_source,base_amount,'posted',entry_id) returning id into purchase_id;
   if prod is not null then insert into purchase_items(household_id,purchase_id,product_id,quantity,unit_cost,total_source) values(p_household_id,purchase_id,prod,1,p_amount_source,p_amount_source); insert into stock_movements(household_id,product_id,location_id,type,quantity,unit_cost_base,reference_type,reference_id,movement_date) values(p_household_id,prod,loc,'purchase',1,base_amount,'purchase',purchase_id,current_date); end if;
   insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,inventory_account,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,debit_account,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
 elsif p_operation_type in ('operating_expense','family_expense') then
   insert into expenses(household_id,category_id,cash_account_id,activity_id,scope,expense_date,amount_source,amount_base,currency,status,journal_entry_id) select p_household_id,c.id,cash_account,activity,case when p_operation_type='operating_expense' then 'operating' else 'family' end,current_date,p_amount_source,base_amount,p_currency,'posted',entry_id from categories c where c.household_id=p_household_id and c.type=case when p_operation_type='operating_expense' then 'operating_expense' else 'family_expense' end order by name limit 1 returning id into expense_id;
   insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,case when p_operation_type='operating_expense' then opex_account else family_account end,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,debit_account,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
 elsif p_operation_type='transfer' then
   if cash_account is null or second_cash is null or cash_account=second_cash then raise exception 'transfer requires distinct source and destination cash accounts'; end if;
   insert into payments(household_id,cash_account_id,amount_source,currency,exchange_rate,payment_date,status,journal_entry_id) values(p_household_id,second_cash,p_amount_source,p_currency,p_exchange_rate,current_date,'posted',entry_id);
   insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,debit_account,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,debit_account,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
 elsif p_operation_type in ('family_contribution','family_withdrawal','savings_contribution') then
   if p_operation_type='savings_contribution' then
     if goal is null then insert into savings_goals(household_id,name,target_amount,currency,priority,status) values(p_household_id,'Épargne générale',p_amount_source,p_currency,1,'active') returning id into goal; end if;
     insert into savings_contributions(household_id,savings_goal_id,source_cash_account_id,savings_cash_account_id,amount_source,contribution_date,journal_entry_id) values(p_household_id,goal,cash_account,savings_cash,p_amount_source,current_date,entry_id);
   end if;
   insert into journal_lines(household_id,journal_entry_id,ledger_account_id,debit_base,credit_base,currency,source_amount,exchange_rate) values (p_household_id,entry_id,case when p_operation_type='family_withdrawal' then equity_account when p_operation_type='savings_contribution' then savings_account else debit_account end,base_amount,0,p_currency,p_amount_source,p_exchange_rate),(p_household_id,entry_id,case when p_operation_type='family_withdrawal' then debit_account when p_operation_type='savings_contribution' then debit_account else equity_account end,0,base_amount,p_currency,p_amount_source,p_exchange_rate);
 else raise exception 'unsupported operation type %', p_operation_type;
 end if;
 perform post_journal_entry(entry_id,p_idempotency_key);
 return entry_id;
end $$;
