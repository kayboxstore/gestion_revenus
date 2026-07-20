-- Opening inventory is contributed capital: it increases inventory without
-- creating cash, revenue or an expense. All writes stay inside controlled RPCs.

create or replace function record_opening_stock(
  p_household_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_total_value_source numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_operation_date date,
  p_description text,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  effective_date date := coalesce(p_operation_date,current_date);
  base_amount numeric(20,4) := round(p_total_value_source*p_exchange_rate,4);
  unit_cost_base numeric(20,4);
  entry_id uuid := gen_random_uuid();
  existing_entry_id uuid;
  existing_payload jsonb;
  product_activity uuid;
  location_id uuid;
  inventory_account uuid;
  equity_account uuid;
  fingerprint jsonb;
  entry_number text;
begin
  if not can_manage_household(p_household_id) then
    raise exception 'not allowed';
  end if;
  if p_quantity is null or p_quantity<=0
     or p_total_value_source is null or p_total_value_source<=0
     or p_exchange_rate is null or p_exchange_rate<=0 then
    raise exception 'opening stock quantity, value and exchange rate must be positive';
  end if;
  if nullif(trim(p_description),'') is null then
    raise exception 'description is required';
  end if;
  if nullif(trim(p_idempotency_key),'') is null then
    raise exception 'idempotency key required';
  end if;

  fingerprint := jsonb_build_object(
    'operation_type','opening_stock',
    'product_id',p_product_id,
    'quantity',p_quantity,
    'total_value_source',p_total_value_source,
    'currency',p_currency,
    'exchange_rate',p_exchange_rate,
    'operation_date',effective_date,
    'description',trim(p_description)
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_household_id::text||':'||p_idempotency_key,0)
  );
  select id,operation_payload into existing_entry_id,existing_payload
  from journal_entries
  where household_id=p_household_id and idempotency_key=p_idempotency_key
  for update;
  if existing_entry_id is not null then
    if existing_payload=fingerprint then return existing_entry_id; end if;
    raise exception 'idempotency key conflict for household';
  end if;

  if not exists(
    select 1 from currencies
    where household_id=p_household_id and code=p_currency and active
  ) then
    raise exception 'source currency is invalid';
  end if;

  select activity_id into product_activity
  from products
  where household_id=p_household_id
    and id=p_product_id
    and type='physical'
    and active;
  if product_activity is null then
    raise exception 'opening stock requires an active physical product';
  end if;

  select id into location_id
  from inventory_locations
  where household_id=p_household_id and primary_location and active
  order by name
  limit 1;
  if location_id is null then
    raise exception 'inventory location is required';
  end if;

  select id into inventory_account
  from ledger_accounts
  where household_id=p_household_id and code='inventory';
  select id into equity_account
  from ledger_accounts
  where household_id=p_household_id and code='equity';
  if inventory_account is null or equity_account is null then
    raise exception 'opening stock ledger accounts are missing';
  end if;

  unit_cost_base := round(base_amount/p_quantity,4);
  entry_number := 'OPEN-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')
    ||'-'||substr(replace(entry_id::text,'-',''),1,8);

  insert into journal_entries(
    id,household_id,number,type,entry_date,status,description,activity_id,
    created_by,operation_payload
  ) values(
    entry_id,p_household_id,entry_number,'opening_stock',effective_date,'draft',
    trim(p_description),product_activity,auth.uid(),fingerprint
  );

  insert into stock_movements(
    household_id,product_id,location_id,type,quantity,unit_cost_base,
    reference_type,reference_id,movement_date
  ) values(
    p_household_id,p_product_id,location_id,'opening',p_quantity,
    unit_cost_base,'opening_stock',entry_id,effective_date
  );

  insert into journal_lines(
    household_id,journal_entry_id,ledger_account_id,cash_account_id,
    debit_base,credit_base,currency,source_amount,exchange_rate
  ) values
    (p_household_id,entry_id,inventory_account,null,
      base_amount,0,p_currency,p_total_value_source,p_exchange_rate),
    (p_household_id,entry_id,equity_account,null,
      0,base_amount,p_currency,p_total_value_source,p_exchange_rate);

  return post_journal_entry(entry_id,p_idempotency_key);
end
$$;

create or replace function get_inventory_snapshot(p_household_id uuid)
returns table(
  product_id uuid,
  quantity numeric(20,4),
  value_base numeric(20,4),
  weighted_unit_cost_base numeric(20,4)
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not is_household_member(p_household_id) then
    raise exception 'not allowed';
  end if;

  return query
  select
    p.id,
    coalesce(sum(sm.quantity),0)::numeric(20,4),
    coalesce(sum(sm.quantity*sm.unit_cost_base),0)::numeric(20,4),
    case
      when coalesce(sum(sm.quantity),0)>0
        then round(sum(sm.quantity*sm.unit_cost_base)/sum(sm.quantity),4)
      else 0
    end::numeric(20,4)
  from products p
  left join stock_movements sm
    on sm.household_id=p.household_id and sm.product_id=p.id
  where p.household_id=p_household_id and p.type='physical' and p.active
  group by p.id
  order by p.name;
end
$$;

-- Cash is not the same as total assets: inventory and receivables must never
-- appear in the treasury KPI. Only journal lines tied to a user cash account
-- contribute to this figure.
create or replace function get_dashboard_kpis(
  p_household_id uuid,
  p_from date default null,
  p_to date default null,
  p_activity_id uuid default null
) returns table(
  revenue numeric,
  gross_profit numeric,
  net_profit numeric,
  family_expenses numeric,
  savings numeric,
  cash numeric
)
language sql
stable
security definer
set search_path=public
as $$
  select
    coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base else 0 end),0),
    coalesce(sum(case when a.account_type='income' then l.credit_base-l.debit_base when a.account_type='cogs' then l.credit_base-l.debit_base else 0 end),0),
    coalesce(sum(case when a.account_type in ('income','cogs','operating_expense') then l.credit_base-l.debit_base else 0 end),0),
    coalesce(sum(case when a.account_type='family_expense' then l.debit_base-l.credit_base else 0 end),0),
    coalesce(sum(case when a.code='savings' then l.debit_base-l.credit_base else 0 end),0),
    coalesce(sum(case when l.cash_account_id is not null then l.debit_base-l.credit_base else 0 end),0)
  from journal_lines l
  join journal_entries e on e.id=l.journal_entry_id
  join ledger_accounts a on a.id=l.ledger_account_id
  where l.household_id=p_household_id
    and is_household_member(p_household_id)
    and e.status in ('posted','reversed')
    and (p_from is null or e.entry_date>=p_from)
    and (p_to is null or e.entry_date<=p_to)
    and (p_activity_id is null or e.activity_id=p_activity_id);
$$;

-- Stock movements are append-only projections. Managers must use controlled
-- financial RPCs just like operators; direct table writes are never required.
drop policy if exists stock_movements_manager_direct_write on stock_movements;

create or replace function prevent_stock_movement_changes()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  raise exception 'stock movements are immutable';
end
$$;

drop trigger if exists stock_movements_no_changes on stock_movements;
create trigger stock_movements_no_changes
before update or delete on stock_movements
for each row execute function prevent_stock_movement_changes();

-- The generic journal reversal already reverses the ledger. This trigger keeps
-- the inventory projection in sync for opening-stock entries in the same
-- transaction and refuses a reversal that would create negative stock.
create or replace function reverse_opening_stock_projection()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  movement record;
  stock_after numeric(20,4);
  reversal_entry_id uuid;
begin
  if old.status='posted' and new.status='reversed' and old.type='opening_stock' then
    select id into reversal_entry_id
    from journal_entries
    where household_id=old.household_id
      and reversal_of=old.id
      and type='reversal'
      and status='posted'
    order by created_at desc
    limit 1;
    if reversal_entry_id is null then
      raise exception 'opening stock reversal entry is missing';
    end if;

    for movement in
      select sm.*
      from stock_movements sm
      where sm.household_id=old.household_id
        and sm.reference_type='opening_stock'
        and sm.reference_id=old.id
      for update
    loop
      select quantity into stock_after
      from current_stock_balance(old.household_id,movement.product_id);
      if stock_after-movement.quantity<0 then
        raise exception 'reversal would make stock negative';
      end if;
      insert into stock_movements(
        household_id,product_id,location_id,type,quantity,unit_cost_base,
        reference_type,reference_id,movement_date
      ) values(
        movement.household_id,movement.product_id,movement.location_id,
        'reversal',-movement.quantity,movement.unit_cost_base,
        'journal_reversal',reversal_entry_id,current_date
      );
    end loop;
  end if;
  return new;
end
$$;

drop trigger if exists journal_entries_reverse_opening_stock on journal_entries;
create trigger journal_entries_reverse_opening_stock
after update of status on journal_entries
for each row execute function reverse_opening_stock_projection();

revoke all on function record_opening_stock(
  uuid,uuid,numeric,numeric,text,numeric,date,text,text
) from public;
grant execute on function record_opening_stock(
  uuid,uuid,numeric,numeric,text,numeric,date,text,text
) to authenticated;
revoke all on function get_inventory_snapshot(uuid) from public;
grant execute on function get_inventory_snapshot(uuid) to authenticated;
revoke all on function get_dashboard_kpis(uuid,date,date,uuid) from public;
grant execute on function get_dashboard_kpis(uuid,date,date,uuid) to authenticated;
