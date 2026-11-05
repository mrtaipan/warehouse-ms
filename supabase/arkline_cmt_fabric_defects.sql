create table if not exists public.arkline_cmt_fabric_defect_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  code_prefix text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_cmt_fabric_defect_group_prefix_check
    check (code_prefix ~ '^[A-Z]{1,3}$')
);

create unique index if not exists arkline_cmt_fabric_defect_groups_name_key
  on public.arkline_cmt_fabric_defect_groups (lower(name));

create table if not exists public.arkline_cmt_fabric_defects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.arkline_cmt_fabric_defect_groups(id)
    on update cascade on delete restrict,
  code text not null unique,
  defect_name text not null check (btrim(defect_name) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_cmt_fabric_defect_code_check
    check (code ~ '^[A-Z]{1,3}[0-9]{2,}$')
);

create unique index if not exists arkline_cmt_fabric_defects_group_name_key
  on public.arkline_cmt_fabric_defects (group_id, lower(defect_name));

create index if not exists arkline_cmt_fabric_defects_group_order_idx
  on public.arkline_cmt_fabric_defects (group_id, sort_order, code);

create or replace function public.validate_arkline_cmt_fabric_defect_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_prefix text;
begin
  select code_prefix into expected_prefix
  from public.arkline_cmt_fabric_defect_groups
  where id = new.group_id;

  if expected_prefix is null or new.code !~ ('^' || expected_prefix || '[0-9]{2,}$') then
    raise exception 'Defect code % must use its group prefix followed by at least two digits', new.code;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_arkline_cmt_fabric_defect_code
  on public.arkline_cmt_fabric_defects;
create trigger validate_arkline_cmt_fabric_defect_code
before insert or update of group_id, code on public.arkline_cmt_fabric_defects
for each row execute function public.validate_arkline_cmt_fabric_defect_code();

create or replace function public.protect_arkline_cmt_fabric_defect_prefix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code_prefix is distinct from old.code_prefix and exists (
    select 1 from public.arkline_cmt_fabric_defects where group_id = old.id
  ) then
    raise exception 'Cannot change a group prefix after defects have been registered';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_arkline_cmt_fabric_defect_prefix
  on public.arkline_cmt_fabric_defect_groups;
create trigger protect_arkline_cmt_fabric_defect_prefix
before update of code_prefix on public.arkline_cmt_fabric_defect_groups
for each row execute function public.protect_arkline_cmt_fabric_defect_prefix();

create or replace function public.set_arkline_cmt_fabric_defect_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_arkline_cmt_fabric_defect_groups_updated_at
  on public.arkline_cmt_fabric_defect_groups;
create trigger set_arkline_cmt_fabric_defect_groups_updated_at
before update on public.arkline_cmt_fabric_defect_groups
for each row execute function public.set_arkline_cmt_fabric_defect_updated_at();

drop trigger if exists set_arkline_cmt_fabric_defects_updated_at
  on public.arkline_cmt_fabric_defects;
create trigger set_arkline_cmt_fabric_defects_updated_at
before update on public.arkline_cmt_fabric_defects
for each row execute function public.set_arkline_cmt_fabric_defect_updated_at();

insert into public.arkline_cmt_fabric_defect_groups (name, code_prefix, sort_order)
values
  ('Yarn & Knit', 'Y', 1),
  ('Dyeing', 'D', 2),
  ('Finishing/Brushing', 'F', 3),
  ('Printing', 'P', 4)
on conflict (code_prefix) do nothing;

insert into public.arkline_cmt_fabric_defects (group_id, code, defect_name, sort_order)
select groups.id, seed.code, seed.defect_name, seed.sort_order
from (values
  ('Y', 'Y01', 'Slub/Uneven Yarn', 1),
  ('Y', 'Y02', 'Barre', 2),
  ('Y', 'Y03', 'Missing Line', 3),
  ('Y', 'Y04', 'Yarn Contamination', 4),
  ('Y', 'Y05', 'Vertical Line', 5),
  ('Y', 'Y06', 'Pin Hole', 6),
  ('D', 'D01', 'Abration', 1),
  ('D', 'D02', 'Dye Spot', 2),
  ('D', 'D03', 'Crease Mark', 3),
  ('D', 'D04', 'Shading', 4),
  ('D', 'D05', 'Knot', 5),
  ('D', 'D06', 'Joining', 6),
  ('F', 'F01', 'Oil', 1),
  ('F', 'F02', 'Dirt/Soil', 2),
  ('F', 'F03', 'Stop Mark', 3),
  ('F', 'F04', 'Bowing & Skew', 4),
  ('F', 'F05', 'Hole', 5),
  ('P', 'P01', 'Miss Print', 1)
) as seed(prefix, code, defect_name, sort_order)
join public.arkline_cmt_fabric_defect_groups groups on groups.code_prefix = seed.prefix
on conflict (code) do nothing;

alter table public.arkline_cmt_fabric_defect_groups enable row level security;
alter table public.arkline_cmt_fabric_defects enable row level security;

grant select, insert, update on public.arkline_cmt_fabric_defect_groups to authenticated;
grant select, insert, update on public.arkline_cmt_fabric_defects to authenticated;

drop policy if exists arkline_cmt_fabric_defect_groups_select on public.arkline_cmt_fabric_defect_groups;
drop policy if exists arkline_cmt_fabric_defect_groups_insert on public.arkline_cmt_fabric_defect_groups;
drop policy if exists arkline_cmt_fabric_defect_groups_update on public.arkline_cmt_fabric_defect_groups;
drop policy if exists arkline_cmt_fabric_defects_select on public.arkline_cmt_fabric_defects;
drop policy if exists arkline_cmt_fabric_defects_insert on public.arkline_cmt_fabric_defects;
drop policy if exists arkline_cmt_fabric_defects_update on public.arkline_cmt_fabric_defects;

create policy arkline_cmt_fabric_defect_groups_select
on public.arkline_cmt_fabric_defect_groups for select to authenticated
using (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
));

create policy arkline_cmt_fabric_defect_groups_insert
on public.arkline_cmt_fabric_defect_groups for insert to authenticated
with check (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
));

create policy arkline_cmt_fabric_defect_groups_update
on public.arkline_cmt_fabric_defect_groups for update to authenticated
using (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
))
with check (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
));

create policy arkline_cmt_fabric_defects_select
on public.arkline_cmt_fabric_defects for select to authenticated
using (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
));

create policy arkline_cmt_fabric_defects_insert
on public.arkline_cmt_fabric_defects for insert to authenticated
with check (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
));

create policy arkline_cmt_fabric_defects_update
on public.arkline_cmt_fabric_defects for update to authenticated
using (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
))
with check (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
));

