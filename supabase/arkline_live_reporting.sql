begin;

create table if not exists public.arkline_live_reporting_sessions (
  id bigint generated always as identity primary key,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  session_type text not null default 'STANDALONE',
  submitted_by_profile_id uuid references public.dir_user_profiles(id) on delete set null,
  submitted_by text,
  submitted_by_display_name_snapshot text,
  partner_profile_id uuid references public.dir_user_profiles(id) on delete set null,
  partner_email text,
  partner_display_name_snapshot text,
  hero_product_sku text,
  hero_product_name_snapshot text,
  gross_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_live_reporting_sessions_type_check check (session_type in ('STANDALONE', 'PAIRING')),
  constraint arkline_live_reporting_sessions_amount_check check (gross_amount >= 0)
);

create table if not exists public.arkline_live_reporting_credits (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.arkline_live_reporting_sessions(id) on delete cascade,
  participant_profile_id uuid references public.dir_user_profiles(id) on delete set null,
  participant_email text,
  participant_display_name_snapshot text,
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

create index if not exists idx_arkline_live_reporting_credits_participant
  on public.arkline_live_reporting_credits (participant_profile_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
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
on public.arkline_live_reporting_sessions for select to authenticated using (true);

create policy "authenticated_insert_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for insert to authenticated with check (true);

create policy "authenticated_update_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for update to authenticated using (true) with check (true);

create policy "authenticated_delete_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;
drop policy if exists "authenticated_insert_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;
drop policy if exists "authenticated_update_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;
drop policy if exists "authenticated_delete_arkline_live_reporting_credits" on public.arkline_live_reporting_credits;

create policy "authenticated_select_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for select to authenticated using (true);

create policy "authenticated_insert_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for insert to authenticated with check (true);

create policy "authenticated_update_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for update to authenticated using (true) with check (true);

create policy "authenticated_delete_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for delete to authenticated using (true);

commit;
