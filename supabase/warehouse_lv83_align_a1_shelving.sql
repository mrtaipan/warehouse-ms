-- Align A1.1-A1.9 with the existing A2 row spacing on the shared LV83 map.
begin;

do $$
declare
  v_elements jsonb;
  v_updated jsonb;
  v_count integer;
begin
  select elements into v_elements
  from public.warehouse_map_layouts
  where warehouse_key = 'LV83'
  for update;
  if v_elements is null then
    raise exception 'LV83 map layout not found';
  end if;

  select count(*) into v_count
  from jsonb_array_elements(v_elements) as element
  where element->>'type' = 'shelving'
    and element->>'code' ~ '^A1\.[1-9]$';
  if v_count <> 9 then
    raise exception 'Expected exactly nine A1 shelving elements, found %', v_count;
  end if;

  select jsonb_agg(
    case
      when element->>'type' = 'shelving' and element->>'code' ~ '^A1\.[1-9]$'
        then element || jsonb_build_object(
          'x', 38,
          'y', round(72.66 + (split_part(element->>'code', '.', 2)::integer - 1) * 1.9, 2),
          'w', 6,
          'h', 1.9
        )
      else element
    end order by position
  ) into v_updated
  from jsonb_array_elements(v_elements) with ordinality as saved(element, position);

  update public.warehouse_map_layouts
  set elements = v_updated, updated_by = 'CODEX'
  where warehouse_key = 'LV83';
end;
$$;

commit;
