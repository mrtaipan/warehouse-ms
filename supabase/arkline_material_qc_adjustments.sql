-- Material QC corrections keep the inspector result unchanged.
create table if not exists public.arkline_material_qc_adjustments (
  id bigint generated always as identity primary key,
  arkline_material_qc_id uuid not null references public.arkline_material_qc(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('transfer', 'inspector_data_error')),
  from_grade text check (from_grade in ('A', 'B', 'C')),
  to_grade text check (to_grade in ('A', 'B', 'C')),
  affected_grade text check (affected_grade in ('A', 'B', 'C')),
  qty integer not null check (qty > 0),
  notes text,
  source_qc_date date not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint arkline_material_qc_adjustment_grades_check check (
    (adjustment_type = 'transfer' and from_grade is not null and to_grade is not null
      and from_grade <> to_grade and affected_grade is null)
    or (adjustment_type = 'inspector_data_error' and affected_grade is not null
      and from_grade is null and to_grade is null)
  )
);

create index if not exists arkline_material_qc_adjustments_task_idx
  on public.arkline_material_qc_adjustments (arkline_material_qc_id, created_at, id);

create or replace function public.validate_arkline_material_qc_adjustment()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  task public.arkline_material_qc%rowtype;
  source_qty integer;
begin
  if not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to adjust Material QC';
  end if;

  select * into task from public.arkline_material_qc
  where id = new.arkline_material_qc_id for update;
  if not found or task.status <> 'done' then
    raise exception 'Only completed Material QC tasks can be adjusted';
  end if;

  new.created_by := auth.uid();
  new.source_qc_date := (coalesce(task.finished_at, task.created_at) at time zone 'UTC')::date;

  select case coalesce(new.from_grade, new.affected_grade)
    when 'A' then task.qty_a
    when 'B' then task.qty_b
    else task.qty_c
  end + coalesce(sum(
    case
      when adjustment_type = 'transfer' and to_grade = coalesce(new.from_grade, new.affected_grade) then qty
      when adjustment_type = 'transfer' and from_grade = coalesce(new.from_grade, new.affected_grade) then -qty
      when adjustment_type = 'inspector_data_error' and affected_grade = coalesce(new.from_grade, new.affected_grade) then -qty
      else 0
    end
  ), 0) into source_qty
  from public.arkline_material_qc_adjustments
  where arkline_material_qc_id = new.arkline_material_qc_id;

  if new.qty > source_qty then
    raise exception 'Adjustment qty exceeds available source grade (%)', source_qty;
  end if;
  return new;
end;
$$;

drop trigger if exists arkline_material_qc_adjustment_validate on public.arkline_material_qc_adjustments;
create trigger arkline_material_qc_adjustment_validate
before insert on public.arkline_material_qc_adjustments
for each row execute function public.validate_arkline_material_qc_adjustment();

alter table public.arkline_material_qc_adjustments enable row level security;
revoke all on public.arkline_material_qc_adjustments from public, anon, authenticated;
grant select, insert on public.arkline_material_qc_adjustments to authenticated;
grant usage, select on sequence public.arkline_material_qc_adjustments_id_seq to authenticated;
revoke all on function public.validate_arkline_material_qc_adjustment() from public, anon;

drop policy if exists arkline_material_qc_adjustments_select on public.arkline_material_qc_adjustments;
create policy arkline_material_qc_adjustments_select on public.arkline_material_qc_adjustments
for select to authenticated using (public.reqc_has_permission('qc.summary.view')
  or public.reqc_has_permission('qc.confirmation.edit')
  or public.reqc_has_permission('arkline.progress.view'));

drop policy if exists arkline_material_qc_adjustments_insert on public.arkline_material_qc_adjustments;
create policy arkline_material_qc_adjustments_insert on public.arkline_material_qc_adjustments
for insert to authenticated with check (public.reqc_has_permission('qc.confirmation.edit')
  and created_by = (select auth.uid()));
