begin;

create or replace function public.reimbursement_is_admin()
returns boolean
language sql
stable
as $$
  select
    public.current_user_email() = 'mr.peneliti@gmail.com'
    or exists (
      select 1
      from public.dir_user_profiles profile
      where profile.authenticated_id = auth.uid()
        and profile.role in ('hrga', 'leader')
    );
$$;

create or replace function public.reimbursement_is_hrga_reviewer()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dir_user_profiles profile
    where profile.authenticated_id = auth.uid()
      and profile.role in ('hrga', 'leader')
  );
$$;

create or replace function public.mob_payment_is_hrga()
returns boolean
language sql
stable
as $$
  select
    coalesce((auth.jwt() ->> 'email') = 'mr.peneliti@gmail.com', false)
    or exists (
      select 1
      from public.dir_user_profiles profile
      where profile.authenticated_id = auth.uid()
        and profile.role in ('hrga', 'leader')
    );
$$;

commit;
