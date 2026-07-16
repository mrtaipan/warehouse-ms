alter table public.warehouse_returns
  add column if not exists return_reason text null;

alter table public.warehouse_returns
  drop constraint if exists returns_source_phase_check;

alter table public.warehouse_returns
  drop constraint if exists warehouse_returns_source_phase_check;

do $$
declare
  source_phase_constraint record;
begin
  for source_phase_constraint in
    select constraint_info.conname
    from pg_constraint constraint_info
    join pg_class table_info
      on table_info.oid = constraint_info.conrelid
    join pg_namespace schema_info
      on schema_info.oid = table_info.relnamespace
    where schema_info.nspname = 'public'
      and table_info.relname = 'warehouse_returns'
      and constraint_info.contype = 'c'
      and pg_get_constraintdef(constraint_info.oid) ilike '%source_phase%'
  loop
    execute format('alter table public.warehouse_returns drop constraint %I', source_phase_constraint.conname);
  end loop;
end $$;

update public.warehouse_returns
set source_phase = 'Packing List'
where source_phase = 'packing_list';

alter table public.warehouse_returns
  add constraint warehouse_returns_source_phase_check
  check (
    source_phase is null
    or source_phase in ('inbound', 'qc', 'Packing List')
  );

create index if not exists warehouse_returns_pl_identity_idx
  on public.warehouse_returns (source_phase, inbound_id, model_name, variant_name);
