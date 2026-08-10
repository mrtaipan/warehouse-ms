alter table public.warehouse_returns
  add column if not exists product_model_id bigint null,
  add column if not exists product_model_variant_id bigint null,
  add column if not exists source_variant_code text null,
  add column if not exists pl_detail_seq integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'warehouse_returns_product_model_id_fkey'
      and conrelid = 'public.warehouse_returns'::regclass
  ) then
    alter table public.warehouse_returns
      add constraint warehouse_returns_product_model_id_fkey
      foreign key (product_model_id)
      references public.dir_product_models(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'warehouse_returns_product_model_variant_id_fkey'
      and conrelid = 'public.warehouse_returns'::regclass
  ) then
    alter table public.warehouse_returns
      add constraint warehouse_returns_product_model_variant_id_fkey
      foreign key (product_model_variant_id)
      references public.dir_product_model_variants(id)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists warehouse_returns_pl_product_identity_idx
  on public.warehouse_returns (
    source_phase,
    inbound_id,
    product_model_id,
    product_model_variant_id,
    source_variant_code,
    pl_detail_seq
  );

comment on column public.warehouse_returns.product_model_id is
  'Catalog model identity for the returned Packing List item.';

comment on column public.warehouse_returns.product_model_variant_id is
  'Catalog variant identity for the returned Packing List item.';

comment on column public.warehouse_returns.source_variant_code is
  'SKU or variant code captured when the Packing List return was created.';
