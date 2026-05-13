alter table if exists public.qc_pause_logs
  add column if not exists arkline_qc_id uuid null references public.arkline_qc(id) on update cascade on delete cascade;

create index if not exists qc_pause_logs_qc_item_id_idx
  on public.qc_pause_logs (qc_item_id);

create index if not exists qc_pause_logs_arkline_qc_id_idx
  on public.qc_pause_logs (arkline_qc_id);

alter table if exists public.qc_pause_logs
  drop constraint if exists qc_pause_logs_exactly_one_task_check;

alter table if exists public.qc_pause_logs
  add constraint qc_pause_logs_exactly_one_task_check
  check (
    (
      qc_item_id is not null
      and arkline_qc_id is null
    )
    or (
      qc_item_id is null
      and arkline_qc_id is not null
    )
  );

alter table if exists public.qc_pause_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.qc_pause_logs to authenticated;

drop policy if exists qc_pause_logs_authenticated_select on public.qc_pause_logs;
drop policy if exists qc_pause_logs_authenticated_insert on public.qc_pause_logs;
drop policy if exists qc_pause_logs_authenticated_update on public.qc_pause_logs;
drop policy if exists qc_pause_logs_authenticated_delete on public.qc_pause_logs;

create policy qc_pause_logs_authenticated_select
on public.qc_pause_logs
for select
to authenticated
using (true);

create policy qc_pause_logs_authenticated_insert
on public.qc_pause_logs
for insert
to authenticated
with check (true);

create policy qc_pause_logs_authenticated_update
on public.qc_pause_logs
for update
to authenticated
using (true)
with check (true);

create policy qc_pause_logs_authenticated_delete
on public.qc_pause_logs
for delete
to authenticated
using (true);
