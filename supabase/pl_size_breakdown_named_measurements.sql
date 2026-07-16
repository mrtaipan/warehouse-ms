begin;

alter table public.pl_size_breakdown
  add column if not exists width_afterpull text null,
  add column if not exists sleeve_length text null,
  add column if not exists thigh_width text null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'extra_value_1'
  ) then
    update public.pl_size_breakdown
    set width_afterpull = coalesce(width_afterpull, extra_value_1)
    where width_afterpull is null
      and extra_value_1 is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'extra_value_2'
  ) then
    update public.pl_size_breakdown
    set sleeve_length = coalesce(sleeve_length, extra_value_2)
    where sleeve_length is null
      and extra_value_2 is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'extra_value_3'
  ) then
    update public.pl_size_breakdown
    set thigh_width = coalesce(thigh_width, extra_value_3)
    where thigh_width is null
      and extra_value_3 is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'tigh_width'
  ) then
    update public.pl_size_breakdown
    set thigh_width = coalesce(thigh_width, tigh_width)
    where thigh_width is null
      and tigh_width is not null;

    alter table public.pl_size_breakdown drop column tigh_width;
  end if;
end $$;

alter table public.pl_size_breakdown
  drop column if exists extra_value_1,
  drop column if exists extra_value_2,
  drop column if exists extra_value_3;

commit;
