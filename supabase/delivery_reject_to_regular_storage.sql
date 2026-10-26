-- Route rejected MOB/OI customer returns into an existing draft R koli.
-- The Delivery case remains the source of product, size, quantity and reject reason.
alter table public.warehouse_reject_storage
  add column if not exists delivery_return_item_id bigint null
    references public.delivery_return_items(id) on delete restrict;

create unique index if not exists warehouse_reject_storage_delivery_return_item_uidx
  on public.warehouse_reject_storage (delivery_return_item_id)
  where delivery_return_item_id is not null;

-- Delivery return lines do not include a verified product category. Keep the
-- normal Reject Storage requirement for manually entered rows only.
alter table public.warehouse_reject_storage
  alter column category_id drop not null,
  alter column sub_category_id drop not null;

alter table public.warehouse_reject_storage
  drop constraint if exists warehouse_reject_storage_classification_source_check;

alter table public.warehouse_reject_storage
  add constraint warehouse_reject_storage_classification_source_check
  check (
    delivery_return_item_id is not null
    or (category_id is not null and sub_category_id is not null)
  );

-- A linked Delivery decision must not be orphaned by deleting its draft row.
drop policy if exists warehouse_reject_storage_authenticated_delete_draft
  on public.warehouse_reject_storage;
create policy warehouse_reject_storage_authenticated_delete_draft
on public.warehouse_reject_storage
for delete to authenticated
using (
  status = 'DRAFT'
  and delivery_return_item_id is null
  and exists (
    select 1 from public.dir_user_profiles profile
    where profile.authenticated_id = (select auth.uid())
      and (
        lower(btrim(coalesce(warehouse_reject_storage.created_by, ''))) = lower(btrim(coalesce(profile.email, '')))
        or warehouse_reject_storage.created_by = (select auth.uid())::text
        or lower(profile.role) = 'admin'
      )
  )
);

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
    raise exception 'You cannot allocate Delivery rejects from Return Preparation';
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

  -- Lock the existing rows so a posted koli cannot receive another item.
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

create or replace function public.sync_delivery_reject_koli_posting()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.delivery_return_item_id is not null
     and new.status = 'POSTED'
     and old.status is distinct from new.status then
    update public.delivery_return_items
    set route_status = 'REJECTION_STORED',
        updated_at = now(),
        updated_by = coalesce(nullif(btrim(new.posted_by), ''), new.updated_by)
    where id = new.delivery_return_item_id
      and route_status = 'KOLI_ASSIGNED';
  end if;
  return new;
end;
$$;

drop trigger if exists warehouse_reject_storage_delivery_posted
  on public.warehouse_reject_storage;
create trigger warehouse_reject_storage_delivery_posted
  after update of status on public.warehouse_reject_storage
  for each row execute function public.sync_delivery_reject_koli_posting();

revoke all on function public.sync_delivery_reject_koli_posting() from public, anon;

comment on column public.warehouse_reject_storage.delivery_return_item_id is
  'Source Delivery reject item. One return decision may be allocated to one R koli once.';

notify pgrst, 'reload schema';

-- Allocate checked Delivery rejects as one transaction, so a failed row cannot
-- leave only part of the selection in the chosen R koli.
create or replace function public.allocate_delivery_rejects_to_koli(
  p_return_item_ids bigint[],
  p_koli_number text,
  p_grade text,
  p_additional_note text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_count integer := 0;
begin
  if coalesce(array_length(p_return_item_ids, 1), 0) not between 1 and 100
     or array_position(p_return_item_ids, null) is not null
     or (select count(distinct id) from unnest(p_return_item_ids) as ids(id)) <> array_length(p_return_item_ids, 1) then
    raise exception 'Select between 1 and 100 distinct Delivery reject items';
  end if;

  foreach v_id in array p_return_item_ids loop
    perform public.allocate_delivery_reject_to_koli(v_id, p_koli_number, p_grade, p_additional_note);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.allocate_delivery_rejects_to_koli(bigint[], text, text, text) from public, anon;
grant execute on function public.allocate_delivery_rejects_to_koli(bigint[], text, text, text) to authenticated;
notify pgrst, 'reload schema';
