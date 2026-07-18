-- Operators may post the operations they are allowed to create. Administration
-- and reversal of a posted financial entry remain owner/manager-only.
create or replace function can_write_household(h uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select household_role(h) in ('owner','manager','operator')
$$;

-- The policy generator in the initial migration used a formatted identifier
-- followed by a literal suffix, producing names such as
-- activities_writer_write. Remove those legacy operator-write policies; the
-- manager-only policies installed by 202607170003 remain authoritative.
do $$
declare t text;
begin
  foreach t in array array[
    'activities','categories','contacts','products','iptv_plans','currencies',
    'exchange_rates','ledger_accounts','cash_accounts','document_sequences',
    'reconciliations','recurring_templates','inventory_locations',
    'inventory_counts','inventory_count_lines','savings_goals','budgets',
    'budget_lines','attachments','invitations','journal_entries','journal_lines',
    'sales','sale_items','payments','iptv_subscriptions','billiard_sessions',
    'expenses','purchases','purchase_items','stock_movements',
    'savings_contributions'
  ] loop
    execute format('drop policy if exists %I on %I', t||'_writer_write', t);
  end loop;
end $$;

create or replace function reverse_journal_entry(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  original journal_entries%rowtype;
  new_id uuid := gen_random_uuid();
  sale_rec record;
  payment_rec record;
  stock_rec record;
  stock_after numeric(20,4);
  sale_total numeric(20,4);
  paid_after numeric(20,4);
  restored_status sale_status;
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
  perform set_config('app.allow_financial_document_write','on',true);

  for sale_rec in
    select * from sales where household_id=original.household_id and journal_entry_id=original.id for update
  loop
    if exists(
      select 1
      from payments p
      join journal_entries pe on pe.id=p.journal_entry_id
      where p.household_id=original.household_id
        and p.sale_id=sale_rec.id
        and p.status='posted'
        and pe.status='posted'
    ) then
      raise exception 'annulez d''abord les paiements actifs de cette vente';
    end if;
    update sales set status='cancelled'
    where household_id=original.household_id and id=sale_rec.id;
  end loop;

  for payment_rec in
    select * from payments where household_id=original.household_id and journal_entry_id=original.id for update
  loop
    update payments set status='reversed'
    where household_id=original.household_id and id=payment_rec.id;

    if payment_rec.sale_id is not null then
      select total_source into sale_total
      from sales
      where household_id=original.household_id and id=payment_rec.sale_id
      for update;

      select coalesce(sum(balance_applied_source),0) into paid_after
      from payments p
      join journal_entries e on e.id=p.journal_entry_id
      where p.household_id=original.household_id
        and p.sale_id=payment_rec.sale_id
        and p.status='posted'
        and e.status='posted';

      restored_status := case
        when paid_after <= 0 then 'confirmed'::sale_status
        when paid_after >= sale_total then 'paid'::sale_status
        else 'partially_paid'::sale_status
      end;
      update sales set status=restored_status
      where household_id=original.household_id and id=payment_rec.sale_id and status<>'cancelled';
    end if;
  end loop;

  update expenses set status='reversed'
  where household_id=original.household_id and journal_entry_id=original.id;
  update purchases set status='reversed'
  where household_id=original.household_id and journal_entry_id=original.id;

  for stock_rec in
    select sm.*
    from stock_movements sm
    where sm.household_id=original.household_id
      and (
        sm.reference_id in (select id from sales where household_id=original.household_id and journal_entry_id=original.id)
        or sm.reference_id in (select id from purchases where household_id=original.household_id and journal_entry_id=original.id)
      )
    for update
  loop
    select quantity into stock_after
    from current_stock_balance(original.household_id,stock_rec.product_id);
    if stock_after - stock_rec.quantity < 0 then
      raise exception 'reversal would make stock negative';
    end if;
    insert into stock_movements(
      household_id,product_id,location_id,type,quantity,unit_cost_base,
      reference_type,reference_id,movement_date
    ) values(
      stock_rec.household_id,stock_rec.product_id,stock_rec.location_id,
      'reversal',-stock_rec.quantity,stock_rec.unit_cost_base,
      'journal_reversal',new_id,current_date
    );
  end loop;

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
