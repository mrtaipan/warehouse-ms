alter table public.dir_user_profiles
add column if not exists is_qc_active boolean not null default false;

alter table public.dir_user_profiles
add column if not exists qc_active_date date null;

create index if not exists dir_user_profiles_qc_active_idx
  on public.dir_user_profiles (role, is_qc_active, qc_active_date);
