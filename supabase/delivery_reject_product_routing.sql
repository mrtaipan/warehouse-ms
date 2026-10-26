-- Keep Arkline products out of the regular R-koli route, regardless of the
-- customer return case's group. The Arkline review route is handled separately.
begin;

create or replace function public.allocate_delivery_reject_to_koli(
  p_return_item_id bigint,
  p_koli_number text,
  p_grade text,
  p_additional_note text default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.delivery_return_items%rowtype;
  v_case_code text;
  v_koli_number text := upper(btrim(coalesce(p_koli_number, '')));
  v_grade text := upper(btrim(coalesce(p_grade, '')));
  v_note text := nullif(btrim(coalesce(p_additional_note, '')), '');
  v_sku text;
  v_actor text;
  v_storage_id bigint;
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('qc.retur_report.add') then
    raise exception 'You cannot allocate Delivery rejects to an R koli';
  end if;
  if v_koli_number !~ '^R-[0-9]+$' or v_grade not in ('B', 'C') then
    raise exception 'Choose an existing R koli and grade B or C';
  end if;

  select * into v_item
  from public.delivery_return_items
  where id = p_return_item_id
  for update;

  if not found or v_item.outcome <> 'REJECT' or v_item.group_code not in ('MOB', 'OI') then
    raise exception 'This MOB/OI Delivery reject was not found';
  end if;
  if v_item.route_status <> 'PENDING_ARRANGEMENT' then
    raise exception 'This Delivery reject has already been allocated';
  end if;

  v_sku := pg_catalog.regexp_replace(upper(coalesce(v_item.sku, '')), '[^A-Z0-9]', '', 'g');
  if v_sku ~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
     or exists (
       select 1
       from public.arkline_dir_products product
       where v_sku <> ''
         and pg_catalog.regexp_replace(upper(coalesce(product.sku_induk, '')), '[^A-Z0-9]', '', 'g') = v_sku
     ) then
    raise exception 'Arkline products must be reviewed in the Delivery Arkline tab';
  end if;

  select kode_kejadian into v_case_code
  from public.delivery_error_retur_cases
  where id = v_item.case_id and upper(btrim(group_order)) = v_item.group_code;
  if not found then
    raise exception 'The Delivery return case does not match its group';
  end if;

  perform 1 from public.warehouse_reject_storage
  where koli_number = v_koli_number
  order by id
  for update;
  if not found then
    raise exception 'Choose an existing draft R koli';
  end if;
  if exists (
    select 1 from public.warehouse_reject_storage
    where koli_number = v_koli_number and status <> 'DRAFT'
  ) then
    raise exception 'This R koli has been posted and cannot accept more items';
  end if;

  select coalesce(nullif(btrim(email), ''), (select auth.uid())::text)
  into v_actor
  from public.dir_user_profiles
  where authenticated_id = (select auth.uid())
  limit 1;
  v_actor := coalesce(v_actor, (select auth.uid())::text);

  insert into public.warehouse_reject_storage (
    koli_number, delivery_return_item_id, product_name, size, qty, grade,
    reject_note, status, created_by, updated_by
  ) values (
    v_koli_number, v_item.id, v_item.product_name, coalesce(nullif(btrim(v_item.size), ''), '-'),
    v_item.qty, v_grade,
    concat_ws(' | ', 'Delivery ' || v_case_code, nullif(btrim(v_item.reason), ''), v_note),
    'DRAFT', v_actor, v_actor
  ) returning id into v_storage_id;

  update public.delivery_return_items
  set route_status = 'KOLI_ASSIGNED', notes = v_note,
      updated_at = now(), updated_by = v_actor,
      handled_at = now(), handled_by = v_actor
  where id = v_item.id;

  return v_storage_id;
end;
$$;

revoke all on function public.allocate_delivery_reject_to_koli(bigint, text, text, text) from public, anon;
grant execute on function public.allocate_delivery_reject_to_koli(bigint, text, text, text) to authenticated;

commit;
