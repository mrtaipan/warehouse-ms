begin;

alter table public.pl_size_breakdown
  add column if not exists checker_names jsonb not null default '[]'::jsonb;

update public.pl_size_breakdown
set checker_names = case
  when jsonb_typeof(checker_names) = 'array'
    and jsonb_array_length(checker_names) > 0
    then checker_names
  else '[]'::jsonb
end;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'checker_name'
  ) then
    update public.pl_size_breakdown
    set checker_names = to_jsonb(
      array(
        select distinct btrim(item)
        from unnest(string_to_array(checker_name, ',')) as item
        where btrim(item) <> ''
      )
    )
    where jsonb_array_length(checker_names) = 0
      and checker_name is not null
      and btrim(checker_name) <> '';

    alter table public.pl_size_breakdown drop column checker_name;
  end if;
end $$;

alter table public.pl_size_breakdown
  drop constraint if exists pl_size_breakdown_checker_names_array_check;

alter table public.pl_size_breakdown
  add constraint pl_size_breakdown_checker_names_array_check
  check (jsonb_typeof(checker_names) = 'array');

commit;
