-- Run after packaging_supplies.sql. Existing stock starts in Inventory.
begin;

alter table public.packaging_items
  add column if not exists inventory_qty integer,
  add column if not exists display_qty integer not null default 0;

update public.packaging_items set inventory_qty = qty where inventory_qty is null;
alter table public.packaging_items alter column inventory_qty set not null;
alter table public.packaging_items alter column inventory_qty set default 0;
alter table public.packaging_items drop constraint if exists packaging_items_balances_check;
alter table public.packaging_items add constraint packaging_items_balances_check
  check (inventory_qty >= 0 and display_qty >= 0 and qty = inventory_qty + display_qty);

alter table public.packaging_movements
  add column if not exists inventory_delta integer,
  add column if not exists display_delta integer,
  add column if not exists inventory_qty_after integer,
  add column if not exists display_qty_after integer;

alter table public.packaging_movements drop constraint if exists packaging_movements_movement_type_check;
alter table public.packaging_movements drop constraint if exists packaging_movements_qty_change_check;
alter table public.packaging_movements add constraint packaging_movements_movement_type_check
  check (movement_type in ('OPENING', 'IN', 'OUT', 'MOVE', 'ADJUSTMENT'));
alter table public.packaging_movements drop constraint if exists packaging_movements_delta_check;
alter table public.packaging_movements add constraint packaging_movements_delta_check
  check (qty_change <> 0 or movement_type = 'MOVE');

-- Before the split, every movement affected the single warehouse balance.
update public.packaging_movements
set inventory_delta = qty_change,
    display_delta = 0,
    inventory_qty_after = qty_after,
    display_qty_after = 0
where inventory_delta is null;

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
  if p_action = 'ADJUSTMENT' then
    if v_role not in ('warehouse_leader', 'admin') then
      raise exception 'Only Warehouse Leader or admin can adjust packaging stock';
    end if;
    if p_area is null or p_area not in ('INVENTORY', 'DISPLAY')
      or nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'Adjustment area and reason are required';
    end if;
  elsif v_role not in ('warehouse_leader', 'admin')
    and not public.reqc_has_permission('storage.location.edit') then
    raise exception 'Not allowed to change packaging stock';
  end if;

  if p_action <> 'ADJUSTMENT' and p_qty < 1 then
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

revoke all on function public.record_packaging_movement(bigint,text,integer,text) from authenticated;
revoke all on function public.apply_packaging_action(bigint,text,integer,text,text) from public, anon;
grant execute on function public.apply_packaging_action(bigint,text,integer,text,text) to authenticated;

commit;
