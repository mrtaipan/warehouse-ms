-- Bundle availability can be calculated by size or across all component sizes.
alter table public.product_bundles
  add column if not exists is_size_dependent boolean not null default true;

-- MZN03MASB001..005 are size-independent bundles. Their component sizes are
-- only the source stock detail; one bundle is counted from the total recipe.
update public.product_bundles
set is_size_dependent = false,
    updated_at = now()
where bundle_code in (
  'MZN03MASB001',
  'MZN03MASB002',
  'MZN03MASB003',
  'MZN03MASB004',
  'MZN03MASB005'
);

comment on column public.product_bundles.is_size_dependent is
  'When true, bundle availability and storage requirements are matched by SKU and size. When false, sizes are ignored for bundle counting and storage.';

notify pgrst, 'reload schema';
