-- A stock report is an inventory valuation, not a product catalogue.
-- Services such as IPTV are excluded and the monetary amount now represents
-- the remaining inventory value; the quantity stays visible in the detail.
create or replace function get_stock_report(p_household_id uuid)
returns table(label text, amount numeric, detail text)
language sql
stable
security definer
set search_path=public
as $$
  select
    p.name,
    coalesce(sum(sm.quantity * sm.unit_cost_base),0)::numeric(20,4),
    trim(trailing '.' from trim(trailing '0' from coalesce(sum(sm.quantity),0)::text))
      || ' unité(s) en stock'
  from products p
  left join stock_movements sm
    on sm.household_id=p.household_id and sm.product_id=p.id
  where p.household_id=p_household_id
    and p.type='physical'
    and p.active
    and is_household_member(p_household_id)
  group by p.id,p.name
  order by p.name;
$$;

revoke all on function get_stock_report(uuid) from public;
grant execute on function get_stock_report(uuid) to authenticated;
