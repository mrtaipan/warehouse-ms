begin;

create extension if not exists pgcrypto;

alter table public.dir_user_profiles
  add column if not exists profile_id uuid;

update public.dir_user_profiles
set profile_id = gen_random_uuid()
where profile_id is null;

alter table public.dir_user_profiles
  alter column profile_id set not null;

alter table public.dir_user_profiles
  alter column email drop not null;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_employee_profile_id_fkey;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_payee_profile_id_fkey;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_employee_authenticated_id_fkey;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_payee_authenticated_id_fkey;

update public.arkline_reimbursement_claims as claims
set employee_profile_id = profile.profile_id
from public.dir_user_profiles as profile
where claims.employee_profile_id = profile.id;

update public.arkline_reimbursement_claims as claims
set payee_profile_id = profile.profile_id
from public.dir_user_profiles as profile
where claims.payee_profile_id = profile.id;

alter table public.dir_user_profiles
  drop constraint if exists user_profiles_id_fkey;

alter table public.dir_user_profiles
  drop constraint if exists dir_user_profiles_id_fkey;

alter table public.dir_user_profiles
  drop constraint if exists dir_user_profiles_authenticated_id_fkey;

alter table public.dir_user_profiles
  drop constraint if exists dir_user_profiles_pkey;

alter table public.dir_user_profiles
  drop constraint if exists user_profiles_pkey;

alter table public.dir_user_profiles
  rename column id to authenticated_id;

alter table public.dir_user_profiles
  rename column profile_id to id;

alter table public.dir_user_profiles
  alter column id set default gen_random_uuid();

alter table public.dir_user_profiles
  add constraint dir_user_profiles_pkey primary key (id);

create unique index if not exists dir_user_profiles_authenticated_id_unique
  on public.dir_user_profiles (authenticated_id)
  where authenticated_id is not null;

alter table public.dir_user_profiles
  add constraint dir_user_profiles_authenticated_id_fkey
  foreign key (authenticated_id)
  references public.users (id)
  on delete set null;

alter table public.arkline_reimbursement_claims
  rename column employee_profile_id to employee_authenticated_id;

alter table public.arkline_reimbursement_claims
  rename column payee_profile_id to payee_authenticated_id;

alter table public.arkline_reimbursement_claims
  add constraint arkline_reimbursement_claims_employee_authenticated_id_fkey
  foreign key (employee_authenticated_id)
  references auth.users (id)
  on delete set null;

alter table public.arkline_reimbursement_claims
  add constraint arkline_reimbursement_claims_payee_authenticated_id_fkey
  foreign key (payee_authenticated_id)
  references auth.users (id)
  on delete set null;

commit;
