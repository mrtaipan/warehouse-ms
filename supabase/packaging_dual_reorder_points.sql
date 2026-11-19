-- Keep the manually assigned point while showing a separate, calculated
-- consumption point from the last 30 days of OUT movements.
begin;

update public.packaging_items
set reorder_mode = 'FIXED'
where reorder_mode <> 'FIXED';

create or replace function public.set_packaging_reorder(
  p_item_id bigint, p_mode text, p_point integer, p_days integer
) returns public.packaging_items
language plpgsql security definer set search_path = '' as $$
declare v_item public.packaging_items%rowtype;
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('storage.location.edit') then
    raise exception 'Not allowed to change packaging reorder settings';
  end if;
  if p_mode is distinct from 'FIXED' or p_point is null or p_point < 0
    or p_days is null or p_days not between 1 and 365 then
    raise exception 'A nonnegative fixed reorder point is required';
  end if;
  update public.packaging_items
  set reorder_mode = 'FIXED', reorder_point_qty = p_point,
    coverage_days = p_days, updated_at = now()
  where id = p_item_id and active returning * into v_item;
  if not found then raise exception 'Packaging item not found'; end if;
  return v_item;
end;
$$;

revoke all on function public.set_packaging_reorder(bigint,text,integer,integer) from public, anon;
grant execute on function public.set_packaging_reorder(bigint,text,integer,integer) to authenticated;

commit;
