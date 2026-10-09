-- Reset the Reject Storage koli generator to the highest R-XXX
-- number that currently exists in warehouse_reject_storage.
--
-- Examples:
--   highest existing number: R-002 -> next generated number: R-003
--   no existing R-XXX rows -> next generated number: R-001

with reject_koli_sequence as (
  select max((regexp_match(koli_number, '^R(?:JK)?-(\d+)$'))[1]::bigint) as max_sequence
  from public.warehouse_reject_storage
  where koli_number ~ '^R(?:JK)?-\d+$'
)
select setval(
  'public.warehouse_reject_storage_koli_seq',
  greatest(1, coalesce(max_sequence, 1)),
  max_sequence is not null
)
from reject_koli_sequence;

notify pgrst, 'reload schema';
