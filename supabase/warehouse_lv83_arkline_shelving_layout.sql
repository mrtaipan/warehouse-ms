-- Add the mapped A2-A5 Arkline shelving lanes to the saved LV83 map.
-- A1 | A2 A3 | A4 | A5. Existing elements and A1/A6 positions stay intact.

with current_layout as materialized (
  select elements
  from public.warehouse_map_layouts
  where warehouse_key = 'LV83'
  for update
),
lanes(prefix, x, slot_count) as (
  values
    ('A2', 48.0::numeric, 9),
    ('A3', 54.0::numeric, 8),
    ('A4', 66.0::numeric, 8),
    ('A5', 78.0::numeric, 8)
),
desired as (
  select
    lanes.prefix,
    slot.slot_number,
    lanes.prefix || '.' || slot.slot_number as code,
    lanes.x,
    case
      when lanes.prefix = 'A2' then round(72.66 + (slot.slot_number - 1) * 1.9, 2)
      else (a1.element ->> 'y')::numeric
    end as y,
    case
      when lanes.prefix = 'A2' then 1.9::numeric
      else 2.1::numeric
    end as h
  from current_layout
  cross join lanes
  cross join lateral generate_series(1, lanes.slot_count) as slot(slot_number)
  left join lateral (
    select element
    from jsonb_array_elements(current_layout.elements) as saved(element)
    where element ->> 'type' = 'shelving'
      and element ->> 'code' = 'A1.' || slot.slot_number
    limit 1
  ) as a1 on true
  where (lanes.prefix = 'A2' or a1.element is not null)
    and exists (
      select 1
      from public.dir_rack_locations as location
      where location.location_type = 'SHELVING'
        and location.location_id = lanes.prefix
        and location.location_code = slot.slot_number::text
        and location.group_code = 'ARKLINE'
    )
),
missing as (
  select
    desired.prefix,
    desired.slot_number,
    jsonb_build_object(
      'id', 'shelving-LV83-' || desired.code,
      'type', 'shelving',
      'code', desired.code,
      'x', desired.x,
      'y', desired.y,
      'w', 6,
      'h', desired.h,
      'rotation', 0
    ) as element
  from desired
  cross join current_layout
  where not exists (
    select 1
    from jsonb_array_elements(current_layout.elements) as saved(element)
    where element ->> 'type' = 'shelving'
      and element ->> 'code' = desired.code
  )
),
addition as (
  select coalesce(jsonb_agg(element order by prefix, slot_number), '[]'::jsonb) as elements
  from missing
)
update public.warehouse_map_layouts as layout
set elements = layout.elements || addition.elements,
    updated_by = 'CODEX'
from addition
where layout.warehouse_key = 'LV83'
  and jsonb_array_length(addition.elements) > 0
returning layout.warehouse_key, jsonb_array_length(layout.elements) as element_count;