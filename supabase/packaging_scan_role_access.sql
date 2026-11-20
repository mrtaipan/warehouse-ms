-- Run after packaging_inventory_display.sql. The scan page reads only one active item.
begin;

create or replace function public.get_packaging_scan_item(p_item_id bigint)
returns table (
  id bigint, name text, unit text, qty integer, inventory_qty integer,
  display_qty integer, reorder_point_qty integer, active boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.dir_user_profiles profile
    where profile.authenticated_id = (select auth.uid())
  ) then
    raise exception 'WMS login required';
  end if;
  return query
  select item.id, item.name, item.unit, item.qty, item.inventory_qty,
    item.display_qty, item.reorder_point_qty, item.active
  from public.packaging_items item
  where item.id = p_item_id and item.active;
end;
$$;

revoke all on function public.get_packaging_scan_item(bigint) from public, anon;
grant execute on function public.get_packaging_scan_item(bigint) to authenticated;

create or replace function public.apply_packaging_action(
  p_item_id bigint, p_action text, p_qty integer, p_area text default null, p_reason text default null
) returns public.packaging_movements
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.packaging_items%rowtype;
  v_movement public.packaging_movements%rowtype;
  v_role text;
  v_inventory_delta integer := 0;
  v_display_delta integer := 0;
  v_note text;
begin
  if (select auth.uid()) is null then raise exception 'Login required'; end if;
  select lower(profile.role) into v_role
  from public.dir_user_profiles profile where profile.authenticated_id = (select auth.uid());
  if v_role is null then raise exception 'User profile not found'; end if;
  if p_action is null or p_action not in ('IN', 'MOVE', 'OUT', 'ADJUSTMENT')
    or p_qty is null or p_qty = 0 then
    raise exception 'Invalid packaging action or quantity';
  end if;
  if p_action <> 'OUT' and v_role not in ('warehouse_leader', 'admin') then
    raise exception 'Only Warehouse Leader or admin can Input, Move, or Adjust packaging stock';
  end if;
  if p_action = 'ADJUSTMENT' then
    if p_area is null or p_area not in ('INVENTORY', 'DISPLAY')
      or nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'Adjustment area and reason are required';
    end if;
  elsif p_qty < 1 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_item from public.packaging_items where id = p_item_id and active for update;
  if not found then raise exception 'Packaging item not found'; end if;
  if p_action = 'IN' then
    v_inventory_delta := p_qty;
  elsif p_action = 'MOVE' then
    v_inventory_delta := -p_qty;
    v_display_delta := p_qty;
  elsif p_action = 'OUT' then
    v_display_delta := -p_qty;
  elsif p_area = 'INVENTORY' then
    v_inventory_delta := p_qty;
  else
    v_display_delta := p_qty;
  end if;
  if v_item.inventory_qty + v_inventory_delta < 0 or v_item.display_qty + v_display_delta < 0 then
    raise exception 'Insufficient stock in source area';
  end if;

  update public.packaging_items
  set inventory_qty = inventory_qty + v_inventory_delta,
      display_qty = display_qty + v_display_delta,
      qty = qty + v_inventory_delta + v_display_delta,
      updated_at = now()
  where id = p_item_id;

  v_note := case when p_action = 'ADJUSTMENT' then btrim(p_reason)
    when p_action = 'IN' then 'Stock in to Inventory'
    when p_action = 'MOVE' then 'Inventory to Display'
    else 'Taken from Display' end;
  insert into public.packaging_movements (
    item_id, movement_type, qty_change, qty_after, note, created_by,
    inventory_delta, display_delta, inventory_qty_after, display_qty_after
  ) values (
    p_item_id, p_action, v_inventory_delta + v_display_delta,
    v_item.qty + v_inventory_delta + v_display_delta, v_note, (select auth.uid()),
    v_inventory_delta, v_display_delta,
    v_item.inventory_qty + v_inventory_delta, v_item.display_qty + v_display_delta
  ) returning * into v_movement;
  return v_movement;
end;
$$;

revoke all on function public.apply_packaging_action(bigint,text,integer,text,text) from public, anon;
grant execute on function public.apply_packaging_action(bigint,text,integer,text,text) to authenticated;

commit;
