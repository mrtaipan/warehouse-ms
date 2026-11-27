-- Run once after packaging_supplies.sql and packaging_inventory_display.sql.
-- Existing Size Sticker Label XS keeps its current stock, movements, and reorder point.
begin;

insert into public.packaging_items
  (category_id, name, unit, pieces_per_unit, sort_order)
select category.id, item.name, item.unit, item.pieces_per_unit, item.sort_order
from (values
  ('Sticker', 'Size Sticker Label S', 'sheet', 421, 5),
  ('Sticker', 'Size Sticker Label M', 'sheet', 421, 6),
  ('Sticker', 'Size Sticker Label L', 'sheet', 421, 7),
  ('Sticker', 'Size Sticker Label XL', 'sheet', 421, 8),
  ('Sticker', 'Size Sticker Label XXL', 'sheet', 421, 9),
  ('Packaging', 'Arkline Packaging Box', 'pcs', null::integer, 13)
) as item(category_name, name, unit, pieces_per_unit, sort_order)
join public.packaging_categories category on category.name = item.category_name
on conflict (name) do nothing;

commit;
