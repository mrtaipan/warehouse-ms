-- Assign the three existing LV83 map pallets to the Arkline reserve locations.
do $$
declare
  layout_elements jsonb;
  matching_slots integer;
  matching_locations integer;
begin
  select elements into layout_elements
  from public.warehouse_map_layouts
  where warehouse_key = 'LV83'
  for update;

  if layout_elements is null then
    raise exception 'LV83 map layout is missing';
  end if;

  select count(*) into matching_locations
  from public.dir_rack_locations location
  join (values
    (3949, 'ARK.L1'),
    (3950, 'ARK.L2'),
    (3961, 'ARK.L3')
  ) expected(id, code) on location.id = expected.id and location.location_code = expected.code
  where location.location_type = 'PALLET'
    and location.group_code = 'ARKLINE'
    and location.location_id = 'Warehouse LV 83';

  if matching_locations <> 3 then
    raise exception 'Expected Arkline reserve locations are missing or changed';
  end if;

  select count(*) into matching_slots
  from jsonb_array_elements(layout_elements) element
  join (values
    ('pallet-1793267465131-nf8oyh', 'ARK.L1'),
    ('pallet-1793267482076-mjtdtf', 'ARK.L2'),
    ('pallet-1793267500111-56twek', 'ARK.L3')
  ) expected(id, code) on element->>'id' = expected.id
  where element->>'type' = 'pallet'
    and coalesce(element->>'code', '') in ('', expected.code);

  if matching_slots <> 3 then
    raise exception 'Expected unassigned LV83 map slots are missing or changed';
  end if;

  update public.warehouse_map_layouts layout
  set elements = (
    select jsonb_agg(
      case element->>'id'
        when 'pallet-1793267465131-nf8oyh' then jsonb_set(element, '{code}', to_jsonb('ARK.L1'::text))
        when 'pallet-1793267482076-mjtdtf' then jsonb_set(element, '{code}', to_jsonb('ARK.L2'::text))
        when 'pallet-1793267500111-56twek' then jsonb_set(element, '{code}', to_jsonb('ARK.L3'::text))
        else element
      end order by ordinality
    )
    from jsonb_array_elements(layout.elements) with ordinality entries(element, ordinality)
  ), updated_at = now(), updated_by = 'system'
  where layout.warehouse_key = 'LV83';
end $$;
