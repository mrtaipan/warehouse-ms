-- Explicit size pairs are aliases, not a global size conversion chart.
create or replace function public.warehouse_size_aliases(p_size text)
returns text[]
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_raw text := upper(btrim(coalesce(p_size, '')));
  v_key text;
  v_pair text[];
begin
  v_key := coalesce(nullif(regexp_replace(v_raw, '[^A-Z0-9]', '', 'g'), ''), '-');
  if v_key = 'NS' then
    v_key := '-';
  end if;
  v_pair := regexp_match(v_raw,
    '(?:^|[^A-Z0-9])((?:[2-8]XL|X{0,3}[SML]))[[:space:]]*/[[:space:]]*([0-9]{2,3})(?:$|[^A-Z0-9])');
  if v_pair is not null then
    return array[v_key, v_pair[1], v_pair[2]];
  end if;
  return array[v_key];
end;
$$;

create or replace function public.warehouse_sizes_match(
  p_stock_size text, p_requested_size text, p_variation_raw text default null
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.warehouse_size_aliases(p_stock_size) && (
    public.warehouse_size_aliases(p_requested_size) ||
    case when cardinality(public.warehouse_size_aliases(p_variation_raw)) > 1
      and public.warehouse_size_aliases(p_variation_raw) && public.warehouse_size_aliases(p_requested_size)
      then public.warehouse_size_aliases(p_variation_raw) else array[]::text[] end
  );
$$;

revoke all on function public.warehouse_size_aliases(text) from public, anon;
revoke all on function public.warehouse_sizes_match(text, text, text) from public, anon;
grant execute on function public.warehouse_size_aliases(text) to authenticated, service_role;
grant execute on function public.warehouse_sizes_match(text, text, text) to authenticated, service_role;
