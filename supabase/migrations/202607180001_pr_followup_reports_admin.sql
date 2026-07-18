create or replace function owner_manage_member(p_household_id uuid, p_user_id uuid, p_role household_role, p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if household_role(p_household_id) <> 'owner' then raise exception 'not allowed'; end if;
  if p_status not in ('active','inactive') then raise exception 'invalid member status'; end if;
  if p_user_id = auth.uid() and p_status <> 'active' then raise exception 'owner cannot deactivate themselves'; end if;
  update household_members set role=p_role, status=p_status where household_id=p_household_id and user_id=p_user_id;
  if not found then raise exception 'member not found'; end if;
  if not exists(
    select 1 from household_members
    where household_id=p_household_id and role='owner' and status='active'
  ) then
    raise exception 'household must keep at least one active owner';
  end if;
  insert into audit_logs(household_id,actor_id,action,entity,entity_id,metadata)
  values(p_household_id,auth.uid(),'manage_member','household_member',p_user_id,jsonb_build_object('role',p_role,'status',p_status));
end $$;

create or replace function owner_create_invitation(p_household_id uuid, p_email text, p_role household_role)
returns uuid language plpgsql security definer set search_path=public as $$
declare invitation_id uuid;
begin
  if household_role(p_household_id) <> 'owner' then raise exception 'not allowed'; end if;
  if nullif(trim(p_email),'') is null or position('@' in p_email) = 0 then raise exception 'invalid email'; end if;
  insert into invitations(household_id,email,role,status) values(p_household_id,lower(trim(p_email)),p_role,'pending') returning id into invitation_id;
  insert into audit_logs(household_id,actor_id,action,entity,entity_id,metadata)
  values(p_household_id,auth.uid(),'create_invitation','invitation',invitation_id,jsonb_build_object('email',lower(trim(p_email)),'role',p_role));
  return invitation_id;
end $$;

create or replace function owner_cancel_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare h uuid;
begin
  select household_id into h from invitations where id=p_invitation_id;
  if h is null or household_role(h) <> 'owner' then raise exception 'not allowed'; end if;
  update invitations set status='cancelled' where id=p_invitation_id and status='pending';
  insert into audit_logs(household_id,actor_id,action,entity,entity_id) values(h,auth.uid(),'cancel_invitation','invitation',p_invitation_id);
end $$;

create or replace function get_activity_margins(p_household_id uuid, p_from date default null, p_to date default null, p_activity_id uuid default null)
returns table(label text, amount numeric, detail text) language sql stable security definer set search_path=public as $$
  select coalesce(a.name,'Sans activité'), coalesce(sum(case when la.account_type in ('income','cogs','operating_expense') then l.credit_base-l.debit_base else 0 end),0),
         'marge et résultat par activité'
  from journal_lines l join journal_entries e on e.id=l.journal_entry_id join ledger_accounts la on la.id=l.ledger_account_id left join activities a on a.id=e.activity_id
  where l.household_id=p_household_id and is_household_member(p_household_id) and e.status='posted' and (p_from is null or e.entry_date>=p_from) and (p_to is null or e.entry_date<=p_to) and (p_activity_id is null or e.activity_id=p_activity_id)
  group by a.name order by 2 desc;
$$;

create or replace function get_expenses_by_category(p_household_id uuid, p_from date default null, p_to date default null, p_activity_id uuid default null)
returns table(label text, amount numeric, detail text) language sql stable security definer set search_path=public as $$
  select c.name, coalesce(sum(e.amount_base),0), c.type from expenses e join categories c on c.id=e.category_id
  where e.household_id=p_household_id and is_household_member(p_household_id) and e.status='posted' and (p_from is null or e.expense_date>=p_from) and (p_to is null or e.expense_date<=p_to) and (p_activity_id is null or e.activity_id=p_activity_id)
  group by c.name,c.type order by 2 desc;
$$;

create or replace function get_account_balances(p_household_id uuid) returns table(label text, amount numeric, detail text) language sql stable security definer set search_path=public as $$
  select ca.name, coalesce(sum(l.debit_base-l.credit_base) filter(where e.id is not null),0), ca.currency
  from cash_accounts ca
  left join journal_lines l on l.cash_account_id=ca.id and l.household_id=ca.household_id
  left join journal_entries e on e.id=l.journal_entry_id and e.status='posted'
  where ca.household_id=p_household_id and is_household_member(p_household_id)
  group by ca.name, ca.currency order by ca.name;
$$;

create or replace function get_stock_report(p_household_id uuid) returns table(label text, amount numeric, detail text) language sql stable security definer set search_path=public as $$
  select p.name, coalesce(sum(sm.quantity),0), 'quantité en stock' from products p left join stock_movements sm on sm.product_id=p.id where p.household_id=p_household_id and is_household_member(p_household_id) group by p.name order by p.name;
$$;

create or replace function get_receivables_report(p_household_id uuid) returns table(label text, amount numeric, detail text) language sql stable security definer set search_path=public as $$
  select s.number,
         greatest(s.total_base-coalesce(sum(p.balance_applied_source*p.exchange_rate) filter(where p.status='posted' and pe.status='posted'),0),0),
         coalesce(s.status::text,'créance')
  from sales s
  left join payments p on p.sale_id=s.id and p.household_id=s.household_id
  left join journal_entries pe on pe.id=p.journal_entry_id
  where s.household_id=p_household_id and is_household_member(p_household_id) and s.status in ('confirmed','partially_paid','overdue')
  group by s.id,s.number,s.total_base,s.status,s.due_date,s.sale_date
  having greatest(s.total_base-coalesce(sum(p.balance_applied_source*p.exchange_rate) filter(where p.status='posted' and pe.status='posted'),0),0) > 0
  order by s.due_date nulls last, s.sale_date desc;
$$;

create or replace function get_savings_progress(p_household_id uuid) returns table(label text, amount numeric, detail text) language sql stable security definer set search_path=public as $$
  select g.name,
         coalesce(sum(c.amount_source) filter(where e.status='posted'),0),
         'cible '||g.target_amount::text||' '||g.currency
  from savings_goals g
  left join savings_contributions c on c.savings_goal_id=g.id and c.household_id=g.household_id
  left join journal_entries e on e.id=c.journal_entry_id
  where g.household_id=p_household_id and is_household_member(p_household_id)
  group by g.name,g.target_amount,g.currency,g.priority order by g.priority;
$$;

revoke all on function owner_manage_member(uuid,uuid,household_role,text) from public; grant execute on function owner_manage_member(uuid,uuid,household_role,text) to authenticated;
revoke all on function owner_create_invitation(uuid,text,household_role) from public; grant execute on function owner_create_invitation(uuid,text,household_role) to authenticated;
revoke all on function owner_cancel_invitation(uuid) from public; grant execute on function owner_cancel_invitation(uuid) to authenticated;
revoke all on function get_activity_margins(uuid,date,date,uuid), get_expenses_by_category(uuid,date,date,uuid), get_account_balances(uuid), get_stock_report(uuid), get_receivables_report(uuid), get_savings_progress(uuid) from public;
grant execute on function get_activity_margins(uuid,date,date,uuid), get_expenses_by_category(uuid,date,date,uuid), get_account_balances(uuid), get_stock_report(uuid), get_receivables_report(uuid), get_savings_progress(uuid) to authenticated;
