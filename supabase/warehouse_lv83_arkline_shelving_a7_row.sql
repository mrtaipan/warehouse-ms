-- Complete the mapped A7 Arkline shelving row to the right of A7.1 on LV83.
-- Existing map elements, including A7.1, are not moved.

with current_layout as materialized (
  select elements
  from public.warehouse_map_layouts
  where warehouse_key = 'LV83'
  for update
),
anchor as (
  select saved.element
  from current_layout
  cross join lateral jsonb_array_elements(current_layout.elements) as saved(element)
  where saved.element ->> 'type' = 'shelving'
    and saved.element ->> 'code' = 'A7.1'
  limit 1
),
missing as (
  select
    slot.slot_number,
    jsonb_build_object(
      'id', 'shelving-LV83-A7.' || slot.slot_number,
      'type', 'shelving',
      'code', 'A7.' || slot.slot_number,
      'x', round(
        (anchor.element ->> 'x')::numeric
          + (slot.slot_number - 1) * ((anchor.element ->> 'w')::numeric + 0.4),
        2
      ),
      'y', (anchor.element ->> 'y')::numeric,
      'w', (anchor.element ->> 'w')::numeric,
      'h', (anchor.element ->> 'h')::numeric,
      'rotation', (anchor.element ->> 'rotation')::numeric
    ) as element
  from current_layout
  cross join anchor
  cross join lateral generate_series(2, 7) as slot(slot_number)
  where exists (
    select 1
    from public.dir_rack_locations as location
    where location.location_type = 'SHELVING'
      and location.location_id = 'A7'
      and location.location_code = slot.slot_number::text
      and location.group_code = 'ARKLINE'
  )
    and not exists (
      select 1
      from jsonb_array_elements(current_layout.elements) as saved(element)
      where saved.element ->> 'type' = 'shelving'
        and saved.element ->> 'code' = 'A7.' || slot.slot_number
    )
),
addition as (
  select coalesce(jsonb_agg(element order by slot_number), '[]'::jsonb) as elements
  from missing
)
update public.warehouse_map_layouts as layout
set elements = layout.elements || addition.elements,
    updated_by = 'CODEX'
from addition
where layout.warehouse_key = 'LV83'
  and jsonb_array_length(addition.elements) > 0
returning layout.warehouse_key, jsonb_array_length(layout.elements) as element_count;