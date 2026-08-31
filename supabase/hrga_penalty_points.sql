begin;

create table if not exists public.hrga_penalty_points (
  id bigserial primary key,
  employee_profile_id text not null references public.dir_user_profiles(id) on delete cascade,
  penalty_date date not null default current_date,
  points integer not null,
  reason text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hrga_penalty_points_points_check check (points > 0),
  constraint hrga_penalty_points_reason_check check (length(trim(reason)) > 0)
);

create index if not exists idx_hrga_penalty_points_employee_date
  on public.hrga_penalty_points (employee_profile_id, penalty_date desc);

create index if not exists idx_hrga_penalty_points_current_period
  on public.hrga_penalty_points (penalty_date desc)
  where penalty_date >= date '2020-01-01';

create or replace function public.set_hrga_penalty_points_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hrga_penalty_points_updated_at on public.hrga_penalty_points;
create trigger trg_hrga_penalty_points_updated_at
before update on public.hrga_penalty_points
for each row execute function public.set_hrga_penalty_points_updated_at();

create or replace function public.hrga_penalty_period_start(target_date date default current_date)
returns date
language sql
stable
as $$
  select make_date(
    extract(year from target_date)::int,
    (((extract(month from target_date)::int - 1) / 3) * 3) + 1,
    1
  );
$$;

create or replace function public.hrga_penalty_can_manage()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = auth.uid()
        or lower(coalesce(profile.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        profile.role = 'admin'
        or exists (
          select 1
          from public.dir_user_roles role_access
          where role_access.role = profile.role
            and role_access.permission_code in (
              'hrga.penalty_points.add',
              'hrga.penalty_points.edit',
              'hrga.penalty_points.delete'
            )
        )
      )
  );
$$;

create or replace function public.hrga_penalty_can_view()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = auth.uid()
        or lower(coalesce(profile.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        profile.role = 'admin'
        or exists (
          select 1
          from public.dir_user_roles role_access
          where role_access.role = profile.role
            and role_access.permission_code in (
              'hrga.penalty_points.view',
              'hrga.penalty_points.add',
              'hrga.penalty_points.edit',
              'hrga.penalty_points.delete'
            )
        )
      )
  );
$$;

create or replace function public.hrga_penalty_is_owner(target_profile_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dir_user_profiles profile
    where profile.id = target_profile_id
      and (
        profile.authenticated_id = auth.uid()
        or lower(coalesce(profile.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.hrga_penalty_target_is_allowed(target_profile_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dir_user_profiles profile
    where profile.id = target_profile_id
      and upper(coalesce(profile."group", '')) = 'WAREHOUSE'
      and lower(coalesce(profile.role, '')) <> 'warehouse_leader'
      and coalesce(trim(profile.resign_date::text), '') = ''
  );
$$;

create or replace view public.hrga_penalty_points_current
with (security_invoker = true)
as
select
  employee_profile_id,
  public.hrga_penalty_period_start(current_date) as period_start,
  (public.hrga_penalty_period_start(current_date) + interval '3 months - 1 day')::date as period_end,
  coalesce(sum(points), 0)::integer as total_points,
  count(*)::integer as entry_count
from public.hrga_penalty_points
where penalty_date >= public.hrga_penalty_period_start(current_date)
  and penalty_date < public.hrga_penalty_period_start(current_date) + interval '3 months'
group by employee_profile_id;

alter table public.hrga_penalty_points enable row level security;

drop policy if exists "authenticated_select_hrga_penalty_points" on public.hrga_penalty_points;
create policy "authenticated_select_hrga_penalty_points"
on public.hrga_penalty_points for select to authenticated
using (
  public.hrga_penalty_can_view()
  or public.hrga_penalty_is_owner(employee_profile_id)
);

drop policy if exists "authenticated_insert_hrga_penalty_points" on public.hrga_penalty_points;
create policy "authenticated_insert_hrga_penalty_points"
on public.hrga_penalty_points for insert to authenticated
with check (
  public.hrga_penalty_can_manage()
  and public.hrga_penalty_target_is_allowed(employee_profile_id)
);

drop policy if exists "authenticated_update_hrga_penalty_points" on public.hrga_penalty_points;
create policy "authenticated_update_hrga_penalty_points"
on public.hrga_penalty_points for update to authenticated
using (public.hrga_penalty_can_manage())
with check (
  public.hrga_penalty_can_manage()
  and public.hrga_penalty_target_is_allowed(employee_profile_id)
);

drop policy if exists "authenticated_delete_hrga_penalty_points" on public.hrga_penalty_points;
create policy "authenticated_delete_hrga_penalty_points"
on public.hrga_penalty_points for delete to authenticated
using (public.hrga_penalty_can_manage());

grant select, insert, update, delete on public.hrga_penalty_points to authenticated;
grant select on public.hrga_penalty_points_current to authenticated;
grant usage, select on sequence public.hrga_penalty_points_id_seq to authenticated;

insert into public.dir_user_permissions (code, label, description)
values
  ('hrga.penalty_points.view', 'View Penalty Points', 'View access for Penalty Points in HRGA.'),
  ('hrga.penalty_points.add', 'Add Penalty Points', 'Add access for Penalty Points in HRGA.'),
  ('hrga.penalty_points.edit', 'Edit Penalty Points', 'Edit access for Penalty Points in HRGA.'),
  ('hrga.penalty_points.delete', 'Delete Penalty Points', 'Delete access for Penalty Points in HRGA.')
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description;

insert into public.dir_user_roles (role, permission_code)
select seed.role, seed.permission_code
from (
  values
    ('hrga', 'hrga.penalty_points.view'),
    ('hrga', 'hrga.penalty_points.add'),
    ('hrga', 'hrga.penalty_points.edit'),
    ('hrga', 'hrga.penalty_points.delete'),
    ('warehouse_leader', 'hrga.penalty_points.view'),
    ('warehouse_leader', 'hrga.penalty_points.add')
) as seed(role, permission_code)
where not exists (
  select 1
  from public.dir_user_roles existing
  where existing.role = seed.role
    and existing.permission_code = seed.permission_code
);

commit;
