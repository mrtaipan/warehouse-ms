begin;

create table if not exists public.arkline_live_reporting_sessions (
  id bigint generated always as identity primary key,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  session_type text not null default 'STANDALONE',
  host_profile_id text references public.dir_user_profiles(id) on delete set null,
  host_display_name_snapshot text,
  partner_profile_id text references public.dir_user_profiles(id) on delete set null,
  partner_display_name_snapshot text,
  wearing_product_sku text,
  partner_wearing_product_sku text,
  gross_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_live_reporting_sessions_type_check check (session_type in ('STANDALONE', 'PAIRING')),
  constraint arkline_live_reporting_sessions_amount_check check (gross_amount >= 0)
);

create table if not exists public.arkline_live_reporting_credits (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.arkline_live_reporting_sessions(id) on delete cascade,
  host_profile_id text references public.dir_user_profiles(id) on delete set null,
  host_display_name_snapshot text,
  credited_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint arkline_live_reporting_credits_amount_check check (credited_amount >= 0)
);

create index if not exists idx_arkline_live_reporting_sessions_date
  on public.arkline_live_reporting_sessions (session_date desc, start_time desc);

create index if not exists idx_arkline_live_reporting_sessions_type
  on public.arkline_live_reporting_sessions (session_type, session_date desc);

create index if not exists idx_arkline_live_reporting_credits_session
  on public.arkline_live_reporting_credits (session_id, created_at desc);

create index if not exists idx_arkline_live_reporting_credits_host
  on public.arkline_live_reporting_credits (host_profile_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.live_reporting_current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.live_reporting_is_admin()
returns boolean
language sql
stable
as $$
  select public.live_reporting_current_user_email() = 'mr.peneliti@gmail.com';
$$;

create or replace function public.live_reporting_current_profile_id()
returns text
language sql
stable
as $$
  select profile.id
  from public.dir_user_profiles profile
  where lower(coalesce(profile.email, '')) = public.live_reporting_current_user_email()
  limit 1;
$$;

create or replace function public.live_reporting_has_permission(target_code text)
returns boolean
language sql
stable
as $$
  select
    public.live_reporting_is_admin()
    or exists (
      select 1
      from public.dir_user_profiles profile
      join public.dir_user_roles role_map
        on role_map.role = profile.role
      where lower(coalesce(profile.email, '')) = public.live_reporting_current_user_email()
        and role_map.permission_code = target_code
    );
$$;

drop trigger if exists trg_arkline_live_reporting_sessions_updated_at on public.arkline_live_reporting_sessions;
create trigger trg_arkline_live_reporting_sessions_updated_at
before update on public.arkline_live_reporting_sessions
for each row execute function public.set_updated_at();

alter table public.arkline_live_reporting_sessions enable row level security;
alter table public.arkline_live_reporting_credits enable row level security;

drop policy if exists "authenticated_select_arkline_live_reporting_sessions" on public.arkline_live_reporting_sessions;
drop policy if exists "authenticated_insert_arkline_live_reporting_sessions" on public.arkline_live_reporting_sessions;
drop policy if exists "authenticated_update_arkline_live_reporting_sessions" on public.arkline_live_reporting_sessions;
drop policy if exists "authenticated_delete_arkline_live_reporting_sessions" on public.arkline_live_reporting_sessions;

create policy "authenticated_select_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for select to authenticated
using (
  public.live_reporting_has_permission('arkline.financial_management.live_reporting.view')
);

create policy "authenticated_insert_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for insert to authenticated
with check (
  public.live_reporting_has_permission('arkline.financial_management.live_reporting.add')
  and host_profile_id = public.live_reporting_current_profile_id()
);

create policy "authenticated_update_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for update to authenticated
using (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
  or host_profile_id = public.live_reporting_current_profile_id()
)
with check (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
  or host_profile_id = public.live_reporting_current_profile_id()
);

create policy "authenticated_delete_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for delete to authenticated
using (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
  or host_profile_id = public.live_reporting_current_profile_id()
);

drop policy if exists "authenticated_select_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;
drop policy if exists "authenticated_insert_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;
drop policy if exists "authenticated_update_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;
drop policy if exists "authenticated_delete_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;

create policy "authenticated_select_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for select to authenticated
using (
  public.live_reporting_has_permission('arkline.financial_management.live_reporting.view')
);

create policy "authenticated_insert_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for insert to authenticated
with check (
  public.live_reporting_has_permission('arkline.financial_management.live_reporting.add')
  and exists (
    select 1
    from public.arkline_live_reporting_sessions session_row
    where session_row.id = session_id
      and (
        public.live_reporting_is_admin()
        or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
        or session_row.host_profile_id = public.live_reporting_current_profile_id()
      )
  )
);

create policy "authenticated_update_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for update to authenticated
using (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
)
with check (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
);

create policy "authenticated_delete_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for delete to authenticated
using (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
  or exists (
    select 1
    from public.arkline_live_reporting_sessions session_row
    where session_row.id = session_id
      and session_row.host_profile_id = public.live_reporting_current_profile_id()
  )
);

insert into public.dir_user_permissions (code, label, description)
values
  ('arkline.financial_management.live_reporting.view', 'View Live Reporting', 'View access for Live Reporting in Arkline.'),
  ('arkline.financial_management.live_reporting.add', 'Add Live Reporting', 'Add access for Live Reporting in Arkline.'),
  ('arkline.financial_management.live_reporting.edit', 'Edit Live Reporting', 'Edit access for Live Reporting in Arkline.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

commit;
