-- Persist the warehouse map builder layout for all authenticated users.
-- Run this once in Supabase before using Save Layout.

create table if not exists public.warehouse_map_layouts (
  warehouse_key text primary key,
  elements jsonb not null default '[]'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_map_layouts_elements_array_check
    check (jsonb_typeof(elements) = 'array')
);

create or replace function public.set_warehouse_map_layout_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists warehouse_map_layouts_set_updated_at
  on public.warehouse_map_layouts;

create trigger warehouse_map_layouts_set_updated_at
before update on public.warehouse_map_layouts
for each row
execute function public.set_warehouse_map_layout_updated_at();

create or replace function public.warehouse_map_is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'mr.peneliti@gmail.com'
    or exists (
      select 1
      from public.dir_user_profiles profile
      where lower(coalesce(profile.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and lower(coalesce(profile.role, '')) = 'admin'
    );
$$;

alter table public.warehouse_map_layouts enable row level security;

grant select, insert, update on public.warehouse_map_layouts to authenticated;

drop policy if exists warehouse_map_layouts_authenticated_select
  on public.warehouse_map_layouts;

create policy warehouse_map_layouts_authenticated_select
on public.warehouse_map_layouts
for select
to authenticated
using (true);

drop policy if exists warehouse_map_layouts_admin_insert
  on public.warehouse_map_layouts;

create policy warehouse_map_layouts_admin_insert
on public.warehouse_map_layouts
for insert
to authenticated
with check (public.warehouse_map_is_admin());

drop policy if exists warehouse_map_layouts_admin_update
  on public.warehouse_map_layouts;

create policy warehouse_map_layouts_admin_update
on public.warehouse_map_layouts
for update
to authenticated
using (public.warehouse_map_is_admin())
with check (public.warehouse_map_is_admin());
