begin;

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
        profile.role in ('admin', 'hrga', 'warehouse_leader')
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
        profile.role in ('admin', 'hrga', 'warehouse_leader')
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

grant select, insert, update, delete on public.hrga_penalty_points to authenticated;
grant select on public.hrga_penalty_points_current to authenticated;
grant usage, select on sequence public.hrga_penalty_points_id_seq to authenticated;

commit;
