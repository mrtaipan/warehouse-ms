-- Run after restock_request.sql. Existing completed requests remain unchanged.
alter table public.restock_request
  add column if not exists requester_user_id uuid;

create index if not exists restock_request_owner_status_idx
  on public.restock_request (requester_user_id, request_status);

-- Only associate legacy open requests when the display name identifies exactly one user.
with unique_owners as (
  select upper(btrim(profile.display_name)) as display_name,
    min(profile.authenticated_id::text)::uuid as user_id
  from public.dir_user_profiles profile
  left join auth.users account on account.id = profile.authenticated_id
  where nullif(btrim(profile.display_name), '') is not null
  group by upper(btrim(profile.display_name))
  having count(*) = 1 and count(account.id) = 1
)
update public.restock_request request
set requester_user_id = owner.user_id
from unique_owners owner
where request.request_status = 'open'
  and request.requester_user_id is null
  and to_jsonb(request) ->> 'return_case_id' is null
  and upper(btrim(request.requester_name)) = owner.display_name;

create or replace function public.restock_request_guard_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_manage_upload boolean;
  can_manage_restock boolean;
  sync_case_id text := current_setting('warehouse.priority_return_case_id', true);
begin
  if actor_id is null then
    if current_user = 'postgres' and tg_op = 'INSERT'
      and current_setting('warehouse.priority_return_backfill', true) = 'on'
      and to_jsonb(new) ->> 'destination_area' = 'RETUR_KEEPING' then
      return new;
    end if;
    if current_user = 'postgres' and tg_op = 'UPDATE' then
      if old.request_status = 'completed'
        and new.request_status = 'completed'
        and to_jsonb(new) - 'sales_upload_credited_qty'
          is not distinct from to_jsonb(old) - 'sales_upload_credited_qty' then
        return new;
      end if;
    end if;
    raise exception 'Authentication is required for restock request changes.' using errcode = '42501';
  end if;

  if pg_trigger_depth() > 1 and sync_case_id is not null then
    if tg_op = 'DELETE' and sync_case_id = to_jsonb(old) ->> 'return_case_id'
      and to_jsonb(old) ->> 'destination_area' = 'RETUR_KEEPING' then
      return old;
    end if;
    if tg_op <> 'DELETE' and sync_case_id = to_jsonb(new) ->> 'return_case_id'
      and to_jsonb(new) ->> 'destination_area' = 'RETUR_KEEPING' then
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(to_jsonb(new) ->> 'destination_area', 'PICKER') <> 'PICKER'
      or to_jsonb(new) ->> 'return_case_id' is not null then
      raise exception 'Only a priority return case can create a linked request.' using errcode = '42501';
    end if;
    new.requester_user_id := coalesce(new.requester_user_id, actor_id);
    if new.requester_user_id is distinct from actor_id or new.request_status <> 'open' then
      raise exception 'A restock request must be created by its owner as open.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if coalesce(to_jsonb(old) ->> 'destination_area', 'PICKER') <> 'PICKER'
      or old.request_status <> 'open'
      or old.requester_user_id is distinct from actor_id then
      raise exception 'Only the requester can delete an open request.' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.request_status = 'open' and new.request_status = 'open' then
    if to_jsonb(old) ->> 'destination_area' = 'RETUR_KEEPING' then
      raise exception 'Edit the return case to change a linked priority request.' using errcode = '42501';
    end if;
    select exists (
      select 1 from public.dir_user_profiles profile
      left join public.dir_user_roles role_map on role_map.role = profile.role
      where profile.authenticated_id = actor_id
        and (profile.role = 'admin' or role_map.permission_code = 'storage.restock_picker.edit')
    ) into can_manage_restock;

    if can_manage_restock
      and lower(btrim(coalesce(old.take_from, ''))) = 'location is not found'
      and to_jsonb(new) - 'take_from' is not distinct from to_jsonb(old) - 'take_from' then
      return new;
    end if;

    if old.requester_user_id is distinct from actor_id
      or to_jsonb(new) - array['item_name', 'size', 'qty', 'take_from', 'search_term', 'source_type', 'note']
        is distinct from
        to_jsonb(old) - array['item_name', 'size', 'qty', 'take_from', 'search_term', 'source_type', 'note'] then
      raise exception 'Only the requester can edit an open request.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.request_status = 'open' and new.request_status = 'completed' then
    if to_jsonb(old) ->> 'destination_area' = 'RETUR_KEEPING'
      and current_setting('warehouse.priority_completion_request_id', true) is distinct from old.id::text then
      raise exception 'Use priority return completion to stage the replacement stock.' using errcode = '42501';
    end if;
    if to_jsonb(new) - array['request_status', 'take_from', 'storage_id', 'completed_at', 'completed_by', 'source_sku_id', 'fulfilled_qty']
      is distinct from
      to_jsonb(old) - array['request_status', 'take_from', 'storage_id', 'completed_at', 'completed_by', 'source_sku_id', 'fulfilled_qty'] then
      raise exception 'Completing a request cannot change its requested item or quantity.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.request_status = 'completed' and new.request_status = 'completed' then
    select exists (
      select 1 from public.dir_user_profiles profile
      left join public.dir_user_roles role_map on role_map.role = profile.role
      where profile.authenticated_id = actor_id
        and (profile.role = 'admin' or role_map.permission_code = 'storage.shelving_upload.edit')
    ) into can_manage_upload;

    if not can_manage_upload
      or to_jsonb(new) - 'sales_upload_credited_qty'
        is distinct from to_jsonb(old) - 'sales_upload_credited_qty' then
      raise exception 'A completed request is locked.' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'This request status transition is not allowed.' using errcode = '42501';
end;
$$;

drop trigger if exists restock_request_guard_mutation_trigger on public.restock_request;
create trigger restock_request_guard_mutation_trigger
before insert or update or delete on public.restock_request
for each row execute function public.restock_request_guard_mutation();

drop policy if exists restock_request_public_insert on public.restock_request;
drop policy if exists restock_request_authenticated_update on public.restock_request;
drop policy if exists restock_request_owner_insert on public.restock_request;
drop policy if exists restock_request_authenticated_mutation on public.restock_request;
drop policy if exists restock_request_owner_delete on public.restock_request;

create policy restock_request_owner_insert
  on public.restock_request for insert to authenticated
  with check (requester_user_id = auth.uid() and request_status = 'open');

-- The trigger narrows edits to owner-only changes, picker completion, and upload credits.
create policy restock_request_authenticated_mutation
  on public.restock_request for update to authenticated
  using (request_status in ('open', 'completed', 'cancelled'))
  with check (request_status in ('open', 'completed', 'cancelled'));

create policy restock_request_owner_delete
  on public.restock_request for delete to authenticated
  using (request_status = 'open' and requester_user_id = auth.uid());

grant select, insert, update, delete on public.restock_request to authenticated;
