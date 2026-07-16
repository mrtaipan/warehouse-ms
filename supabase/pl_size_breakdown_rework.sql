-- Packing List size breakdown rework.
-- Separates PL breakdown identity from catalog/inbound variants.

begin;

alter table public.dir_product_model_variants
  add column if not exists sku_code text,
  add column if not exists source text not null default 'original_catalog',
  add column if not exists promoted_from_pl_detail_id bigint;

alter table public.pl_receiving
  add column if not exists product_model_id bigint references public.dir_product_models(id) on delete set null,
  add column if not exists product_model_variant_id bigint references public.dir_product_model_variants(id) on delete set null,
  add column if not exists source_variant_code text;

alter table public.pl_size_breakdown
  add column if not exists product_model_id bigint references public.dir_product_models(id) on delete set null,
  add column if not exists product_model_variant_id bigint references public.dir_product_model_variants(id) on delete set null,
  add column if not exists source_variant_code text,
  add column if not exists pl_detail_seq integer,
  add column if not exists detail_order integer not null default 1,
  add column if not exists pl_name text,
  add column if not exists checker_names jsonb not null default '[]'::jsonb,
  add column if not exists pl_notes text,
  add column if not exists pl_photo_url text,
  add column if not exists width_afterpull text,
  add column if not exists sleeve_length text,
  add column if not exists thigh_width text,
  add column if not exists sku_group_id text,
  add column if not exists promoted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.pl_size_breakdown
set
  pl_name = coalesce(pl_name, variant_name, variant_label, model_color, model_name, 'PL Item'),
  pl_notes = coalesce(pl_notes, variant_notes),
  pl_photo_url = coalesce(pl_photo_url, variant_photo_url),
  detail_order = coalesce(detail_order, variant_index + 1, 1),
  checker_names = coalesce(checker_names, '[]'::jsonb)
where pl_name is null
   or pl_notes is null
   or pl_photo_url is null
   or checker_names is null;

create index if not exists pl_receiving_product_model_idx
  on public.pl_receiving (inbound_id, product_model_id, product_model_variant_id);

create index if not exists pl_size_breakdown_identity_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, pl_detail_seq);

drop index if exists public.pl_size_breakdown_display_idx;

create index if not exists pl_size_breakdown_detail_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, detail_order);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'dir_product_model_variants'
      and constraint_name = 'dir_product_model_variants_promoted_from_pl_detail_id_fkey'
  ) then
    alter table public.dir_product_model_variants
      add constraint dir_product_model_variants_promoted_from_pl_detail_id_fkey
      foreign key (promoted_from_pl_detail_id)
      references public.pl_size_breakdown(id)
      on delete set null;
  end if;
end $$;

commit;
