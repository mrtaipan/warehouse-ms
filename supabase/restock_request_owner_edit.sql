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
begin
  if actor_id is null then
    raise exception 'Authentication is required for restock request changes.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.requester_user_id := coalesce(new.requester_user_id, actor_id);
    if new.requester_user_id is distinct from actor_id or new.request_status <> 'open' then
      raise exception 'A restock request must be created by its owner as open.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.request_status <> 'open' or old.requester_user_id is distinct from actor_id then
      raise exception 'Only the requester can delete an open request.' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.request_status = 'open' and new.request_status = 'open' then
    if old.requester_user_id is distinct from actor_id
      or to_jsonb(new) - array['item_name', 'size', 'qty', 'take_from', 'search_term', 'source_type', 'note']
        is distinct from
        to_jsonb(old) - array['item_name', 'size', 'qty', 'take_from', 'search_term', 'source_type', 'note'] then
      raise exception 'Only the requester can edit an open request.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.request_status = 'open' and new.request_status = 'completed' then
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
  using (request_status in ('open', 'completed'))
  with check (request_status in ('open', 'completed'));

create policy restock_request_owner_delete
  on public.restock_request for delete to authenticated
  using (request_status = 'open' and requester_user_id = auth.uid());

grant select, insert, update, delete on public.restock_request to authenticated;