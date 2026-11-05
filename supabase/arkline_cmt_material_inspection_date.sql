do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.create_arkline_cmt_material_inspection(uuid,text,numeric,numeric,text,jsonb)'::regprocedure) into definition;
  if position('remarks, inspected_by' in definition) = 0 then raise exception 'Unexpected inspection function definition'; end if;
  definition := replace(definition, 'remarks, inspected_by', 'remarks, inspected_by, inspected_at');
  definition := replace(definition, 'v_profile.display_name' || chr(10) || '  ) returning', 'v_profile.display_name, coalesce(nullif(p_rolls->0->>''inspection_date'', '''')::date::timestamp at time zone ''Asia/Jakarta'', now())' || chr(10) || '  ) returning');
  execute definition;
end;
$migration$;
