-- Only owners and managers may administer reference data or reverse a posted
-- financial entry. Operators keep access to the atomic operation RPC.
create or replace function can_write_household(h uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select household_role(h) in ('owner','manager')
$$;
