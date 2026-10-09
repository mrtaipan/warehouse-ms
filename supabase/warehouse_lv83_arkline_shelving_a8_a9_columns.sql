-- Extend the mapped A8 and A9 Arkline shelving columns below A8.7 and A9.7.
-- Each column reads from top to bottom: .7, .6, .5, .4, .3, .2, .1.

with current_layout as materialized (
  select elements
  from public.warehouse_map_layouts
  where warehouse_key = 'LV83'
  for update
),
anchors as (
  select
    split_part(saved.element ->> 'code', '.', 1) as prefix,
    saved.element
  from current_layout
  cross join lateral jsonb_array_elements(current_layout.elements) as saved(element)
  where saved.element ->> 'type' = 'shelving'
    and saved.element ->> 'code' in ('A8.7', 'A9.7')
),
missing as (
  select
    anchors.prefix,
    slot.slot_number,
    jsonb_build_object(
      'id', 'shelving-LV83-' || anchors.prefix || '.' || slot.slot_number,
      'type', 'shelving',
      'code', anchors.prefix || '.' || slot.slot_number,
      'x', (anchors.element ->> 'x')::numeric,
      'y', round(
        (anchors.element ->> 'y')::numeric
          + (7 - slot.slot_number) * ((anchors.element ->> 'h')::numeric + 0.1),
        2
      ),
      'w', (anchors.element ->> 'w')::numeric,
      'h', (anchors.element ->> 'h')::numeric,
      'rotation', (anchors.element ->> 'rotation')::numeric
    ) as element
  from current_layout
  cross join anchors
  cross join lateral generate_series(1, 6) as slot(slot_number)
  where exists (
    select 1
    from public.dir_rack_locations as location
    where location.location_type = 'SHELVING'
      and location.location_id = anchors.prefix
      and location.location_code = slot.slot_number::text
      and location.group_code = 'ARKLINE'
  )
    and not exists (
      select 1
      from jsonb_array_elements(current_layout.elements) as saved(element)
      where saved.element ->> 'type' = 'shelving'
        and saved.element ->> 'code' = anchors.prefix || '.' || slot.slot_number
    )
),
addition as (
  select coalesce(jsonb_agg(element order by prefix, slot_number desc), '[]'::jsonb) as elements
  from missing
)
update public.warehouse_map_layouts as layout
set elements = layout.elements || addition.elements,
    updated_by = 'CODEX'
from addition
where layout.warehouse_key = 'LV83'
  and jsonb_array_length(addition.elements) > 0
returning layout.warehouse_key, jsonb_array_length(layout.elements) as element_count;