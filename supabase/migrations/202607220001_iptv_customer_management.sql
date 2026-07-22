-- Operational IPTV management: plans, customer terms, expiry alerts and
-- financially atomic activations/renewals.

alter table iptv_plans
  add constraint iptv_plans_duration_positive check(duration_days > 0),
  add constraint iptv_plans_price_positive check(price > 0),
  add constraint iptv_plans_household_id_id_unique unique(household_id,id);

create unique index iptv_plans_household_name_unique
  on iptv_plans(household_id,lower(name));

alter table iptv_subscriptions
  add column if not exists journal_entry_id uuid references journal_entries(id),
  add column if not exists renewed_from_id uuid references iptv_subscriptions(id),
  add column if not exists reminder_days integer not null default 7,
  add column if not exists created_by uuid references profiles(id),
  add column if not exists created_at timestamptz not null default now(),
  add constraint iptv_subscriptions_reminder_days_range
    check(reminder_days between 0 and 90),
  add constraint iptv_subscriptions_dates_valid
    check(expiration_date >= activation_date),
  add constraint iptv_subscriptions_household_id_id_unique
    unique(household_id,id),
  add constraint iptv_subscriptions_contact_same_household
    foreign key(household_id,contact_id) references contacts(household_id,id),
  add constraint iptv_subscriptions_plan_same_household
    foreign key(household_id,plan_id) references iptv_plans(household_id,id),
  add constraint iptv_subscriptions_sale_same_household
    foreign key(household_id,sale_id) references sales(household_id,id),
  add constraint iptv_subscriptions_entry_same_household
    foreign key(household_id,journal_entry_id) references journal_entries(household_id,id),
  add constraint iptv_subscriptions_renewal_same_household
    foreign key(household_id,renewed_from_id) references iptv_subscriptions(household_id,id);

create unique index iptv_subscriptions_one_term_per_entry
  on iptv_subscriptions(household_id,journal_entry_id)
  where journal_entry_id is not null;
create index iptv_subscriptions_expiry_lookup
  on iptv_subscriptions(household_id,expiration_date,status);
create index iptv_subscriptions_customer_lookup
  on iptv_subscriptions(household_id,lower(customer_identifier));

insert into iptv_plans(household_id,name,duration_days,price,currency,active)
select h.id,'Mensuel',30,10,'USD',true
from households h
where not exists(
  select 1 from iptv_plans p where p.household_id=h.id
);

create or replace function install_default_iptv_plan()
returns trigger language plpgsql set search_path=public as $$
begin
  insert into iptv_plans(household_id,name,duration_days,price,currency,active)
  values(new.id,'Mensuel',30,10,'USD',true)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists households_install_default_iptv_plan on households;
create trigger households_install_default_iptv_plan
after insert on households for each row execute function install_default_iptv_plan();

create or replace function prevent_direct_iptv_term_changes()
returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(current_setting('app.allow_financial_document_write',true),'') <> 'on' then
    raise exception 'IPTV terms must be changed by a controlled RPC';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists iptv_subscriptions_controlled_write on iptv_subscriptions;
create trigger iptv_subscriptions_controlled_write
before insert or update or delete on iptv_subscriptions
for each row execute function prevent_direct_iptv_term_changes();

create or replace function cancel_reversed_iptv_term()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='reversed' and old.status='posted' then
    update iptv_subscriptions
    set status='cancelled'
    where household_id=new.household_id and journal_entry_id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists journal_entries_cancel_iptv_term on journal_entries;
create trigger journal_entries_cancel_iptv_term
after update of status on journal_entries
for each row execute function cancel_reversed_iptv_term();

create or replace function record_iptv_subscription_sale(
  p_household_id uuid,
  p_renewed_from_id uuid,
  p_plan_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_identifier text,
  p_activation_date date,
  p_payment_type text,
  p_cash_account_id uuid,
  p_due_date date,
  p_exchange_rate numeric,
  p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  plan_rec iptv_plans%rowtype;
  previous_rec iptv_subscriptions%rowtype;
  v_contact_id uuid;
  v_product_id uuid;
  v_entry_id uuid;
  v_sale_id uuid;
  v_subscription_id uuid;
  start_date date := p_activation_date;
  end_date date;
  customer_name text := nullif(trim(p_customer_name),'');
  customer_phone text := nullif(trim(p_customer_phone),'');
  v_customer_identifier text := nullif(trim(p_customer_identifier),'');
  description text;
  payload jsonb;
begin
  if not can_operate_household(p_household_id) then raise exception 'not allowed'; end if;
  if p_payment_type not in ('cash_sale','credit_sale') then
    raise exception 'invalid IPTV payment type';
  end if;
  if p_activation_date is null or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'activation date and exchange rate are required';
  end if;
  if p_payment_type='cash_sale' and p_cash_account_id is null then
    raise exception 'cash sale requires a cash account';
  end if;
  if p_payment_type='credit_sale' and p_due_date is null then
    raise exception 'credit sale requires a due date';
  end if;
  if p_payment_type='credit_sale' and p_due_date<p_activation_date then
    raise exception 'credit due date cannot precede the sale date';
  end if;

  select * into plan_rec
  from iptv_plans
  where household_id=p_household_id and id=p_plan_id and active
  for share;
  if not found then raise exception 'IPTV plan is invalid or inactive'; end if;
  if not exists(
    select 1 from currencies
    where household_id=p_household_id and code=plan_rec.currency and active
  ) then raise exception 'IPTV plan currency is inactive'; end if;

  select p.id into v_product_id
  from products p
  join activities a on a.household_id=p.household_id and a.id=p.activity_id
  where p.household_id=p_household_id and p.active and p.type='service'
    and a.code='IPTV' and a.active
  order by p.name
  limit 1;
  if v_product_id is null then raise exception 'active IPTV service product is required'; end if;

  if p_renewed_from_id is not null then
    select * into previous_rec
    from iptv_subscriptions
    where household_id=p_household_id and id=p_renewed_from_id
      and status<>'cancelled'
    for update;
    if not found then raise exception 'IPTV subscription to renew was not found'; end if;
    v_contact_id := previous_rec.contact_id;
    v_customer_identifier := previous_rec.customer_identifier;
    start_date := greatest(p_activation_date,previous_rec.expiration_date+1);
    select c.name,c.phone into customer_name,customer_phone
    from contacts c
    where c.household_id=p_household_id and c.id=v_contact_id;
  elsif customer_name is null or v_customer_identifier is null then
    raise exception 'customer name and identifier are required';
  end if;

  end_date := start_date + (plan_rec.duration_days-1);
  description := case when p_renewed_from_id is null
    then 'Activation IPTV · ' else 'Renouvellement IPTV · ' end
    ||customer_name||' · '||plan_rec.name;
  payload := jsonb_strip_nulls(jsonb_build_object(
    'product_id',v_product_id,
    'quantity','1',
    'contact_id',v_contact_id,
    'source_cash_account_id',case when p_payment_type='cash_sale' then p_cash_account_id else null end,
    'due_date',case when p_payment_type='credit_sale' then p_due_date else null end,
    'operation_date',p_activation_date,
    'iptv_plan_id',p_plan_id,
    'iptv_renewed_from_id',p_renewed_from_id,
    'iptv_customer_name',customer_name,
    'iptv_customer_phone',customer_phone,
    'iptv_customer_identifier',v_customer_identifier,
    'iptv_activation_date',start_date,
    'iptv_expiration_date',end_date
  ));

  v_entry_id := record_financial_operation(
    p_household_id,p_payment_type,plan_rec.price,plan_rec.currency,
    p_exchange_rate,description,'IPTV',p_idempotency_key,payload
  );

  select s.id into v_subscription_id
  from iptv_subscriptions s
  where s.household_id=p_household_id and s.journal_entry_id=v_entry_id;
  if v_subscription_id is not null then return v_subscription_id; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_household_id::text||':iptv:'||lower(v_customer_identifier),0)
  );
  if p_renewed_from_id is null and exists(
    select 1 from iptv_subscriptions s
    where s.household_id=p_household_id
      and lower(s.customer_identifier)=lower(v_customer_identifier)
      and s.status<>'cancelled'
  ) then
    raise exception 'IPTV customer identifier already exists';
  end if;
  if p_renewed_from_id is not null and exists(
    select 1 from iptv_subscriptions s
    where s.household_id=p_household_id
      and s.renewed_from_id=p_renewed_from_id
      and s.status<>'cancelled'
  ) then
    raise exception 'IPTV subscription was already renewed';
  end if;

  perform set_config('app.allow_financial_document_write','on',true);
  select s.id into v_sale_id
  from sales s
  where s.household_id=p_household_id and s.journal_entry_id=v_entry_id;
  if v_sale_id is null then raise exception 'IPTV sale document was not created'; end if;

  if v_contact_id is null then
    insert into contacts(household_id,name,is_customer,phone)
    values(p_household_id,customer_name,true,customer_phone)
    returning id into v_contact_id;
    update sales set contact_id=v_contact_id
    where household_id=p_household_id and id=v_sale_id;
  end if;

  insert into iptv_subscriptions(
    household_id,contact_id,plan_id,customer_identifier,activation_date,
    expiration_date,status,sale_id,journal_entry_id,renewed_from_id,created_by
  ) values(
    p_household_id,v_contact_id,p_plan_id,v_customer_identifier,start_date,
    end_date,'active',v_sale_id,v_entry_id,p_renewed_from_id,auth.uid()
  ) returning id into v_subscription_id;

  insert into audit_logs(household_id,actor_id,action,entity,entity_id,metadata)
  values(
    p_household_id,auth.uid(),
    case when p_renewed_from_id is null then 'activate_iptv' else 'renew_iptv' end,
    'iptv_subscription',v_subscription_id,
    jsonb_build_object(
      'plan_id',p_plan_id,'activation_date',start_date,
      'expiration_date',end_date,'sale_id',v_sale_id,
      'renewed_from_id',p_renewed_from_id
    )
  );
  return v_subscription_id;
end $$;

create or replace function get_iptv_subscriptions(
  p_household_id uuid,
  p_status text default 'all',
  p_search text default null,
  p_as_of date default current_date,
  p_limit integer default 24,
  p_offset integer default 0
) returns table(
  subscription_id uuid,
  contact_id uuid,
  customer_name text,
  customer_phone text,
  customer_identifier text,
  plan_id uuid,
  plan_name text,
  plan_price numeric,
  plan_currency text,
  activation_date date,
  expiration_date date,
  lifecycle_status text,
  sale_id uuid,
  sale_number text,
  sale_status text,
  renewed_from_id uuid,
  total_count bigint
) language plpgsql stable security definer set search_path=public as $$
begin
  if not is_household_member(p_household_id) then raise exception 'not allowed'; end if;
  if p_status not in ('all','active','expiring','expired','cancelled','suspended','attention') then
    raise exception 'invalid IPTV status filter';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination';
  end if;

  return query
  with ranked as (
    select
      s.*,
      row_number() over(
        partition by lower(s.customer_identifier)
        order by case when s.status='cancelled' then 1 else 0 end,
                 s.expiration_date desc,s.created_at desc
      ) as customer_rank
    from iptv_subscriptions s
    where s.household_id=p_household_id
  ), base as (
    select
      s.id as subscription_id,
      s.contact_id,
      c.name as customer_name,
      c.phone as customer_phone,
      s.customer_identifier,
      p.id as plan_id,
      p.name as plan_name,
      p.price as plan_price,
      p.currency as plan_currency,
      s.activation_date,
      s.expiration_date,
      case
        when s.status in ('cancelled','suspended') then s.status
        when s.renewed_from_id is null and s.activation_date>p_as_of then 'scheduled'
        when s.expiration_date<p_as_of then 'expired'
        when s.expiration_date<=p_as_of+s.reminder_days then 'expiring'
        else 'active'
      end as lifecycle_status,
      s.sale_id,
      sa.number as sale_number,
      sa.status::text as sale_status,
      s.renewed_from_id
    from ranked s
    join contacts c on c.household_id=s.household_id and c.id=s.contact_id
    join iptv_plans p on p.household_id=s.household_id and p.id=s.plan_id
    left join sales sa on sa.household_id=s.household_id and sa.id=s.sale_id
    where s.customer_rank=1
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or c.name ilike '%'||trim(p_search)||'%'
        or coalesce(c.phone,'') ilike '%'||trim(p_search)||'%'
        or s.customer_identifier ilike '%'||trim(p_search)||'%'
      )
  ), filtered as (
    select * from base
    where p_status='all'
      or lifecycle_status=p_status
      or (p_status='attention' and lifecycle_status in ('expiring','expired'))
  )
  select f.*,count(*) over() as total_count
  from filtered f
  order by
    case f.lifecycle_status
      when 'expired' then 0 when 'expiring' then 1 when 'scheduled' then 2
      when 'active' then 3 when 'suspended' then 4 else 5
    end,
    f.expiration_date,f.customer_name
  limit p_limit offset p_offset;
end $$;

create or replace function get_iptv_overview(
  p_household_id uuid,
  p_as_of date default current_date
) returns table(
  customer_count bigint,
  active_count bigint,
  expiring_count bigint,
  expired_count bigint,
  next_expiration date
) language plpgsql stable security definer set search_path=public as $$
begin
  if not is_household_member(p_household_id) then raise exception 'not allowed'; end if;
  return query
  with ranked as (
    select s.*,
      row_number() over(
        partition by lower(s.customer_identifier)
        order by case when s.status='cancelled' then 1 else 0 end,
                 s.expiration_date desc,s.created_at desc
      ) as customer_rank
    from iptv_subscriptions s
    where s.household_id=p_household_id
  ), current_terms as (
    select *,case
      when status in ('cancelled','suspended') then status
      when renewed_from_id is null and activation_date>p_as_of then 'scheduled'
      when expiration_date<p_as_of then 'expired'
      when expiration_date<=p_as_of+reminder_days then 'expiring'
      else 'active'
    end as lifecycle_status
    from ranked where customer_rank=1
  )
  select
    count(*) filter(where lifecycle_status<>'cancelled'),
    count(*) filter(where lifecycle_status in ('active','expiring','scheduled')),
    count(*) filter(where lifecycle_status='expiring'),
    count(*) filter(where lifecycle_status='expired'),
    min(expiration_date) filter(where lifecycle_status in ('active','expiring','scheduled'))
  from current_terms;
end $$;

revoke all on function record_iptv_subscription_sale(uuid,uuid,uuid,text,text,text,date,text,uuid,date,numeric,text) from public;
grant execute on function record_iptv_subscription_sale(uuid,uuid,uuid,text,text,text,date,text,uuid,date,numeric,text) to authenticated;
revoke all on function get_iptv_subscriptions(uuid,text,text,date,integer,integer) from public;
grant execute on function get_iptv_subscriptions(uuid,text,text,date,integer,integer) to authenticated;
revoke all on function get_iptv_overview(uuid,date) from public;
grant execute on function get_iptv_overview(uuid,date) to authenticated;
