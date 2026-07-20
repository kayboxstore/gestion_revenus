-- Daily inventory management: professional product settings and traceable
-- physical counts. A count records a discrepancy but never changes accounting
-- or stock movements silently.

alter table inventory_counts
  add column if not exists idempotency_key text;

alter table inventory_counts
  add column if not exists submitted_payload jsonb not null default '{}'::jsonb;

alter table stock_movements
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists inventory_counts_household_id_idempotency_key_unique
  on inventory_counts(household_id,idempotency_key)
  where idempotency_key is not null;

create index if not exists stock_movements_household_id_created_at_idx
  on stock_movements(household_id,created_at desc);

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='products_low_stock_threshold_nonnegative'
  ) then
    alter table products
      add constraint products_low_stock_threshold_nonnegative
      check(low_stock_threshold>=0);
  end if;

  if not exists(
    select 1 from pg_constraint
    where conname='products_suggested_price_nonnegative'
  ) then
    alter table products
      add constraint products_suggested_price_nonnegative
      check(suggested_price is null or suggested_price>=0);
  end if;

  if not exists(
    select 1 from pg_constraint
    where conname='inventory_count_lines_counted_quantity_nonnegative'
  ) then
    alter table inventory_count_lines
      add constraint inventory_count_lines_counted_quantity_nonnegative
      check(counted_quantity>=0);
  end if;
end
$$;

create or replace function update_stock_product_settings(
  p_household_id uuid,
  p_product_id uuid,
  p_sku text,
  p_suggested_price numeric,
  p_low_stock_threshold numeric
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  normalized_sku text := nullif(upper(trim(p_sku)),'');
begin
  if not can_manage_household(p_household_id) then
    raise exception 'not allowed';
  end if;
  if p_low_stock_threshold is null or p_low_stock_threshold<0 then
    raise exception 'low stock threshold must be nonnegative';
  end if;
  if p_suggested_price is not null and p_suggested_price<0 then
    raise exception 'suggested price must be nonnegative';
  end if;

  update products
  set
    sku=normalized_sku,
    suggested_price=p_suggested_price,
    low_stock_threshold=p_low_stock_threshold
  where household_id=p_household_id
    and id=p_product_id
    and type='physical'
    and active;

  if not found then
    raise exception 'active physical product not found';
  end if;

  insert into audit_logs(
    household_id,actor_id,action,entity,entity_id,metadata
  ) values(
    p_household_id,auth.uid(),'update_stock_settings','product',p_product_id,
    jsonb_build_object(
      'sku',normalized_sku,
      'suggested_price',p_suggested_price,
      'low_stock_threshold',p_low_stock_threshold
    )
  );

  return p_product_id;
end
$$;

create or replace function record_inventory_count(
  p_household_id uuid,
  p_product_id uuid,
  p_counted_quantity numeric,
  p_count_date date,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  effective_date date := coalesce(p_count_date,current_date);
  location_id uuid;
  theoretical numeric(20,4);
  count_id uuid := gen_random_uuid();
  existing_id uuid;
  existing_payload jsonb;
  fingerprint jsonb;
begin
  if not can_operate_household(p_household_id) then
    raise exception 'not allowed';
  end if;
  if p_counted_quantity is null or p_counted_quantity<0 then
    raise exception 'counted quantity must be nonnegative';
  end if;
  if effective_date>current_date then
    raise exception 'inventory count date cannot be in the future';
  end if;
  if nullif(trim(p_idempotency_key),'') is null then
    raise exception 'idempotency key required';
  end if;
  if not exists(
    select 1 from products
    where household_id=p_household_id
      and id=p_product_id
      and type='physical'
      and active
  ) then
    raise exception 'active physical product not found';
  end if;

  select id into location_id
  from inventory_locations
  where household_id=p_household_id and primary_location and active
  order by name
  limit 1;
  if location_id is null then
    raise exception 'primary inventory location not found';
  end if;

  fingerprint := jsonb_build_object(
    'product_id',p_product_id,
    'counted_quantity',p_counted_quantity,
    'count_date',effective_date
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_household_id::text||':'||p_idempotency_key,0)
  );
  select id,submitted_payload into existing_id,existing_payload
  from inventory_counts
  where household_id=p_household_id and idempotency_key=p_idempotency_key
  for update;
  if existing_id is not null then
    if existing_payload=fingerprint then
      return existing_id;
    end if;
    raise exception 'idempotency key conflict for household';
  end if;

  select quantity into theoretical
  from current_stock_balance(p_household_id,p_product_id);
  theoretical := coalesce(theoretical,0)::numeric(20,4);

  insert into inventory_counts(
    id,household_id,location_id,status,count_date,responsible_id,
    idempotency_key,submitted_payload
  ) values(
    count_id,p_household_id,location_id,'completed',effective_date,auth.uid(),
    p_idempotency_key,fingerprint
  );

  insert into inventory_count_lines(
    household_id,inventory_count_id,product_id,theoretical_quantity,
    counted_quantity,difference
  ) values(
    p_household_id,count_id,p_product_id,theoretical,p_counted_quantity,
    round(p_counted_quantity-theoretical,4)
  );

  insert into audit_logs(
    household_id,actor_id,action,entity,entity_id,metadata
  ) values(
    p_household_id,auth.uid(),'record_inventory_count','inventory_count',
    count_id,jsonb_build_object(
      'product_id',p_product_id,
      'theoretical_quantity',theoretical,
      'counted_quantity',p_counted_quantity,
      'difference',round(p_counted_quantity-theoretical,4),
      'count_date',effective_date
    )
  );

  return count_id;
end
$$;

revoke all on function update_stock_product_settings(uuid,uuid,text,numeric,numeric) from public;
grant execute on function update_stock_product_settings(uuid,uuid,text,numeric,numeric) to authenticated;

revoke all on function record_inventory_count(uuid,uuid,numeric,date,text) from public;
grant execute on function record_inventory_count(uuid,uuid,numeric,date,text) to authenticated;
