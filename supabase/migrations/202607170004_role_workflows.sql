-- Operators may post the operations they are allowed to create. Administration
-- and reversal of a posted financial entry remain owner/manager-only.
create or replace function can_write_household(h uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select household_role(h) in ('owner','manager','operator')
$$;

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
  if not found or not can_manage_household(original.household_id) then
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
