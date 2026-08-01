create or replace function public.set_inbound_sample_model_breakdown_defaults()
returns trigger
language plpgsql
as $$
declare
  source_row record;
  model_row record;
  variant_row record;
  next_breakdown_total integer;
begin
  select
    iu.id,
    iu.inbound_id,
    iu.brand_id,
    iu.category_id,
    iu.qty,
    iu.is_sample
  into source_row
  from public.inbound_unload iu
  where iu.id = new.inbound_unload_id;

  if not found then
    raise exception 'Inbound sample source % was not found.', new.inbound_unload_id;
  end if;

  if coalesce(source_row.is_sample, false) is not true then
    raise exception 'Inbound unload row % is not a sample row.', new.inbound_unload_id;
  end if;

  new.inbound_id := coalesce(new.inbound_id, source_row.inbound_id);
  new.brand_id := coalesce(new.brand_id, source_row.brand_id);
  new.category_id := coalesce(new.category_id, source_row.category_id);

  if new.product_model_variant_id is not null then
    select
      v.id,
      v.product_model_id,
      coalesce(nullif(v.selling_name, ''), nullif(v.variant_name, ''), nullif(v.variant_code, '')) as display_variant_name,
      v.variant_photo_url
    into variant_row
    from public.dir_product_model_variants v
    where v.id = new.product_model_variant_id;

    if not found then
      raise exception 'Product model variant % was not found.', new.product_model_variant_id;
    end if;

    new.product_model_id := coalesce(new.product_model_id, variant_row.product_model_id);
    new.variant_name := coalesce(nullif(new.variant_name, ''), variant_row.display_variant_name);
    new.photo_url := coalesce(nullif(new.photo_url, ''), variant_row.variant_photo_url);
  end if;

  if new.product_model_id is not null then
    select
      m.id,
      m.model_name,
      m.brand_id,
      m.category_id
    into model_row
    from public.dir_product_models m
    where m.id = new.product_model_id;

    if not found then
      raise exception 'Product model % was not found.', new.product_model_id;
    end if;

    if new.product_model_variant_id is not null and variant_row.product_model_id <> model_row.id then
      raise exception 'Variant % does not belong to model %.', new.product_model_variant_id, new.product_model_id;
    end if;

    new.model_name := coalesce(nullif(new.model_name, ''), model_row.model_name);
    new.brand_id := coalesce(new.brand_id, model_row.brand_id);
    new.category_id := coalesce(new.category_id, model_row.category_id);
  end if;

  if nullif(new.model_name, '') is null then
    raise exception 'Model name is required for sample model breakdown.';
  end if;

  select coalesce(sum(qty), 0)
  into next_breakdown_total
  from public.inbound_sample_model_breakdowns
  where inbound_unload_id = new.inbound_unload_id
    and id <> coalesce(new.id, 0);

  next_breakdown_total := next_breakdown_total + new.qty;

  if next_breakdown_total > coalesce(source_row.qty, 0) then
    raise exception 'Sample model breakdown total % cannot exceed sample qty % for inbound unload row %.', next_breakdown_total, source_row.qty, new.inbound_unload_id;
  end if;

  new.updated_at := now();
  return new;
end $$;
