-- Keep existing variants intact; their original creator cannot be inferred reliably.
alter table public.dir_product_model_variants
  add column if not exists created_by text,
  add column if not exists updated_by text;
