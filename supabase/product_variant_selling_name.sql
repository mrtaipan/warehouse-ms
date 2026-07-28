-- Add sales/display names for product variants.
-- selling_name is editable from Product Directory and does not rewrite historical PL names.

begin;

alter table public.dir_product_model_variants
  add column if not exists selling_name text;

comment on column public.dir_product_model_variants.selling_name is
  'Sales/display name for the variant. When filled, UI displays it before PL or internal variant names.';

commit;
