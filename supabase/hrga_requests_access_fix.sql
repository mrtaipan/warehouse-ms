begin;

create or replace function public.hrga_actor_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.hrga_is_admin()
returns boolean
language sql
stable
as $$
  select
    public.hrga_actor_email() = 'mr.peneliti@gmail.com'
    or exists (
      select 1
      from public.dir_user_profiles profile
      where (
          profile.authenticated_id = auth.uid()
          or lower(coalesce(profile.email, '')) = public.hrga_actor_email()
        )
        and profile.role = 'admin'
    );
$$;

create or replace function public.hrga_is_approver()
returns boolean
language sql
stable
as $$
  select
    public.hrga_is_admin()
    or exists (
      select 1
      from public.dir_user_profiles profile
      where (
          profile.authenticated_id = auth.uid()
          or lower(coalesce(profile.email, '')) = public.hrga_actor_email()
        )
        and profile.role in ('hrga', 'leader')
    );
$$;

alter table public.hrga_leave_requests enable row level security;
alter table public.hrga_birthday_gift enable row level security;

drop policy if exists "authenticated_select_hrga_leave_requests" on public.hrga_leave_requests;
drop policy if exists "authenticated_insert_hrga_leave_requests" on public.hrga_leave_requests;
drop policy if exists "authenticated_update_hrga_leave_requests" on public.hrga_leave_requests;
drop policy if exists "authenticated_delete_hrga_leave_requests" on public.hrga_leave_requests;

create policy "authenticated_select_hrga_leave_requests"
on public.hrga_leave_requests for select to authenticated
using (
  public.hrga_is_approver()
  or employee_authenticated_id = auth.uid()
  or lower(coalesce(employee_email_snapshot, '')) = public.hrga_actor_email()
);

create policy "authenticated_insert_hrga_leave_requests"
on public.hrga_leave_requests for insert to authenticated
with check (
  (
    employee_authenticated_id = auth.uid()
    or lower(coalesce(employee_email_snapshot, '')) = public.hrga_actor_email()
    or public.hrga_is_approver()
  )
  and status = 'SUBMITTED'
);

create policy "authenticated_update_hrga_leave_requests"
on public.hrga_leave_requests for update to authenticated
using (
  public.hrga_is_approver()
  or (
    employee_authenticated_id = auth.uid()
    and status = 'SUBMITTED'
  )
)
with check (
  public.hrga_is_approver()
  or (
    employee_authenticated_id = auth.uid()
    and status = 'SUBMITTED'
  )
);

create policy "authenticated_delete_hrga_leave_requests"
on public.hrga_leave_requests for delete to authenticated
using (
  public.hrga_is_approver()
  or (
    employee_authenticated_id = auth.uid()
    and status = 'SUBMITTED'
  )
);

drop policy if exists "authenticated_select_hrga_birthday_gift" on public.hrga_birthday_gift;
drop policy if exists "authenticated_insert_hrga_birthday_gift" on public.hrga_birthday_gift;
drop policy if exists "authenticated_update_hrga_birthday_gift" on public.hrga_birthday_gift;
drop policy if exists "authenticated_delete_hrga_birthday_gift" on public.hrga_birthday_gift;

create policy "authenticated_select_hrga_birthday_gift"
on public.hrga_birthday_gift for select to authenticated
using (
  public.hrga_is_approver()
  or employee_authenticated_id = auth.uid()
  or lower(coalesce(employee_email_snapshot, '')) = public.hrga_actor_email()
);

create policy "authenticated_insert_hrga_birthday_gift"
on public.hrga_birthday_gift for insert to authenticated
with check (
  (
    employee_authenticated_id = auth.uid()
    or lower(coalesce(employee_email_snapshot, '')) = public.hrga_actor_email()
    or public.hrga_is_approver()
  )
  and status = 'SUBMITTED'
);

create policy "authenticated_update_hrga_birthday_gift"
on public.hrga_birthday_gift for update to authenticated
using (
  public.hrga_is_approver()
  or (
    employee_authenticated_id = auth.uid()
    and status = 'SUBMITTED'
  )
)
with check (
  public.hrga_is_approver()
  or (
    employee_authenticated_id = auth.uid()
    and status = 'SUBMITTED'
  )
);

create policy "authenticated_delete_hrga_birthday_gift"
on public.hrga_birthday_gift for delete to authenticated
using (
  public.hrga_is_approver()
  or (
    employee_authenticated_id = auth.uid()
    and status = 'SUBMITTED'
  )
);

commit;
