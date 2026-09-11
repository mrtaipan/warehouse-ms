-- Add optional product category tagging for stored warehouse items.
-- Used by Storage Location leader-only category action.

alter table public.warehouse_storage
  add column if not exists category_id bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'warehouse_storage_category_id_fkey'
      and conrelid = 'public.warehouse_storage'::regclass
  ) then
    alter table public.warehouse_storage
      add constraint warehouse_storage_category_id_fkey
      foreign key (category_id)
      references public.dir_categories(id)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists warehouse_storage_category_id_idx
  on public.warehouse_storage (category_id);

comment on column public.warehouse_storage.category_id is
  'Optional product category assigned from Storage Location by warehouse leaders.';
