-- Rename only the historical Kay Box household. The migration is deliberately
-- scoped so that no unrelated household can be renamed in a multi-tenant setup.

with target_households as (
  select id, name as old_name
  from households
  where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) in (
    'kay box',
    'kaybox',
    'kay box family',
    'kaybox family',
    'famille kay box',
    'famille kaybox'
  )
),
renamed_households as (
  update households as household
  set name = 'Kayembe'
  from target_households as target
  where household.id = target.id
  returning household.id, target.old_name, household.name as new_name
)
insert into audit_logs(
  household_id,
  actor_id,
  action,
  entity,
  entity_id,
  metadata
)
select
  id,
  null,
  'rename_household',
  'household',
  id,
  jsonb_build_object(
    'old_name', old_name,
    'new_name', new_name,
    'source', '202607200004_family_kayembe_identity'
  )
from renamed_households;
