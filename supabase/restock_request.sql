create table if not exists public.restock_request (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null,
  item_name text not null,
  size text,
  qty integer not null check (qty > 0),
  take_from text not null,
  storage_id bigint null,
  search_term text not null,
  source_type text not null default 'MOB',
  request_status text not null default 'open' check (request_status in ('open', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  completed_by text null
);

alter table public.restock_request
  add column if not exists completed_by text null;

alter table public.restock_request
  add column if not exists source_type text;

update public.restock_request
set source_type = 'MOB'
where source_type is null
   or trim(source_type) = '';

alter table public.restock_request
  alter column source_type set default 'MOB';

alter table public.restock_request
  alter column source_type set not null;

alter table public.restock_request
  drop constraint if exists restock_request_source_type_check;

alter table public.restock_request
  add constraint restock_request_source_type_check
  check (source_type in ('MOB', 'ARKLINE'));

create index if not exists restock_request_status_created_idx
  on public.restock_request (request_status, created_at desc);

create index if not exists restock_request_source_type_status_idx
  on public.restock_request (source_type, request_status, created_at desc);

alter table public.restock_request enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restock_request'
      and policyname = 'restock_request_public_select'
  ) then
    create policy restock_request_public_select
      on public.restock_request
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restock_request'
      and policyname = 'restock_request_public_insert'
  ) then
    create policy restock_request_public_insert
      on public.restock_request
      for insert
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restock_request'
      and policyname = 'restock_request_authenticated_update'
  ) then
    create policy restock_request_authenticated_update
      on public.restock_request
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
