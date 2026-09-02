begin;

create extension if not exists pgcrypto;

create table if not exists public.arkline_qc_return_size_corrections (
  id uuid primary key default gen_random_uuid(),
  return_batch_id uuid not null references public.arkline_qc_return_batches(id) on update cascade on delete cascade,
  from_return_batch_line_id uuid not null references public.arkline_qc_return_batch_lines(id) on update cascade on delete restrict,
  from_size text not null,
  to_size text not null,
  qty integer not null check (qty > 0),
  notes text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_qc_return_size_corrections_size_check
    check (upper(trim(from_size)) <> upper(trim(to_size)))
);

create index if not exists arkline_qc_return_size_corrections_batch_idx
  on public.arkline_qc_return_size_corrections (return_batch_id, created_at desc);

create index if not exists arkline_qc_return_size_corrections_source_line_idx
  on public.arkline_qc_return_size_corrections (from_return_batch_line_id);

create or replace function public.validate_arkline_qc_return_size_correction()
returns trigger
language plpgsql
as $$
declare
  source_line public.arkline_qc_return_batch_lines%rowtype;
  corrected_out_qty integer;
begin
  new.from_size = upper(trim(new.from_size));
  new.to_size = upper(trim(new.to_size));
  new.updated_at = now();

  if new.from_size = '' or new.to_size = '' then
    raise exception 'From size and to size are required';
  end if;

  select *
  into source_line
  from public.arkline_qc_return_batch_lines
  where id = new.from_return_batch_line_id
  for update;

  if source_line.id is null then
    raise exception 'Return batch line not found';
  end if;

  if source_line.return_batch_id is distinct from new.return_batch_id then
    raise exception 'Size correction line must belong to the selected return batch';
  end if;

  if upper(trim(source_line.size)) <> new.from_size then
    raise exception 'From size must match the selected return batch line size';
  end if;

  select coalesce(sum(qty), 0)
  into corrected_out_qty
  from public.arkline_qc_return_size_corrections
  where from_return_batch_line_id = new.from_return_batch_line_id
    and id is distinct from new.id;

  if corrected_out_qty + new.qty > source_line.qty then
    raise exception 'Size correction qty exceeds the source line qty';
  end if;

  return new;
end;
$$;

drop trigger if exists arkline_qc_return_size_corrections_validate on public.arkline_qc_return_size_corrections;
create trigger arkline_qc_return_size_corrections_validate
before insert or update on public.arkline_qc_return_size_corrections
for each row execute function public.validate_arkline_qc_return_size_correction();

create or replace view public.arkline_qc_return_corrected_size_summary as
with sent_by_size as (
  select
    line.return_batch_id,
    upper(trim(line.size)) as size,
    sum(line.qty)::integer as sent_qty,
    0::integer as correction_in_qty,
    0::integer as correction_out_qty
  from public.arkline_qc_return_batch_lines line
  group by line.return_batch_id, upper(trim(line.size))
),
correction_out_by_size as (
  select
    correction.return_batch_id,
    correction.from_size as size,
    0::integer as sent_qty,
    0::integer as correction_in_qty,
    sum(correction.qty)::integer as correction_out_qty
  from public.arkline_qc_return_size_corrections correction
  group by correction.return_batch_id, correction.from_size
),
correction_in_by_size as (
  select
    correction.return_batch_id,
    correction.to_size as size,
    0::integer as sent_qty,
    sum(correction.qty)::integer as correction_in_qty,
    0::integer as correction_out_qty
  from public.arkline_qc_return_size_corrections correction
  group by correction.return_batch_id, correction.to_size
)
select
  summary.return_batch_id,
  summary.size,
  sum(summary.sent_qty)::integer as sent_qty,
  sum(summary.correction_in_qty)::integer as correction_in_qty,
  sum(summary.correction_out_qty)::integer as correction_out_qty,
  (sum(summary.sent_qty) + sum(summary.correction_in_qty) - sum(summary.correction_out_qty))::integer as corrected_qty
from (
  select * from sent_by_size
  union all
  select * from correction_out_by_size
  union all
  select * from correction_in_by_size
) summary
group by summary.return_batch_id, summary.size
having sum(summary.sent_qty) + sum(summary.correction_in_qty) - sum(summary.correction_out_qty) <> 0;

alter table public.arkline_qc_return_size_corrections enable row level security;

grant select, insert, update, delete on public.arkline_qc_return_size_corrections to authenticated;
grant select on public.arkline_qc_return_corrected_size_summary to authenticated;

drop policy if exists arkline_qc_return_size_corrections_authenticated_all on public.arkline_qc_return_size_corrections;
create policy arkline_qc_return_size_corrections_authenticated_all
on public.arkline_qc_return_size_corrections
for all
to authenticated
using (true)
with check (true);

comment on table public.arkline_qc_return_size_corrections is
  'Qty-neutral audit log for correcting Arkline QC return size mix after the returned goods size is found to be different from the sent return line.';

comment on view public.arkline_qc_return_corrected_size_summary is
  'Arkline QC return size summary after applying size corrections: sent qty plus correction in minus correction out.';

commit;
