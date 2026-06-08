begin;

create table if not exists public.mob_payment (
  id bigint generated always as identity primary key,
  invoice_number text not null,
  category_id bigint references public.dir_reimbursement_categories(id),
  amount numeric(18,2) not null default 0,
  notes text,
  account_name text not null,
  bank_name text not null,
  account_number text not null,
  status text not null default 'SUBMITTED',
  employee_authenticated_id uuid not null,
  employee_name_snapshot text,
  employee_email_snapshot text,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  paid_by text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mob_payment_status_check check (status in ('SUBMITTED', 'APPROVED', 'PAID')),
  constraint mob_payment_amount_check check (amount >= 0)
);

create table if not exists public.mob_payment_attachments (
  id bigint generated always as identity primary key,
  payment_id bigint not null references public.mob_payment(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mob_payment_status
  on public.mob_payment (status, created_at asc);

create index if not exists idx_mob_payment_invoice
  on public.mob_payment (invoice_number);

create index if not exists idx_mob_payment_category
  on public.mob_payment (category_id);

create index if not exists idx_mob_payment_employee
  on public.mob_payment (employee_authenticated_id, created_at desc);

create index if not exists idx_mob_payment_attachments_payment
  on public.mob_payment_attachments (payment_id, created_at desc);

create or replace function public.mob_payment_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mob_payment_updated_at on public.mob_payment;
create trigger trg_mob_payment_updated_at
before update on public.mob_payment
for each row execute function public.mob_payment_set_updated_at();

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

alter table public.mob_payment enable row level security;
alter table public.mob_payment_attachments enable row level security;

drop policy if exists "mob_payment_select" on public.mob_payment;
drop policy if exists "mob_payment_insert" on public.mob_payment;
drop policy if exists "mob_payment_update" on public.mob_payment;
drop policy if exists "mob_payment_delete" on public.mob_payment;

create policy "mob_payment_select"
on public.mob_payment
for select to authenticated
using (
  employee_authenticated_id = auth.uid()
  or public.mob_payment_is_hrga()
);

create policy "mob_payment_insert"
on public.mob_payment
for insert to authenticated
with check (
  employee_authenticated_id = auth.uid()
  or public.mob_payment_is_hrga()
);

create policy "mob_payment_update"
on public.mob_payment
for update to authenticated
using (
  employee_authenticated_id = auth.uid()
  or public.mob_payment_is_hrga()
)
with check (
  employee_authenticated_id = auth.uid()
  or public.mob_payment_is_hrga()
);

create policy "mob_payment_delete"
on public.mob_payment
for delete to authenticated
using (
  employee_authenticated_id = auth.uid()
  or public.mob_payment_is_hrga()
);

drop policy if exists "mob_payment_attachments_select" on public.mob_payment_attachments;
drop policy if exists "mob_payment_attachments_insert" on public.mob_payment_attachments;
drop policy if exists "mob_payment_attachments_update" on public.mob_payment_attachments;
drop policy if exists "mob_payment_attachments_delete" on public.mob_payment_attachments;

create policy "mob_payment_attachments_select"
on public.mob_payment_attachments
for select to authenticated
using (
  exists (
    select 1
    from public.mob_payment payment
    where payment.id = mob_payment_attachments.payment_id
      and (
        payment.employee_authenticated_id = auth.uid()
        or public.mob_payment_is_hrga()
      )
  )
);

create policy "mob_payment_attachments_insert"
on public.mob_payment_attachments
for insert to authenticated
with check (
  exists (
    select 1
    from public.mob_payment payment
    where payment.id = mob_payment_attachments.payment_id
      and (
        payment.employee_authenticated_id = auth.uid()
        or public.mob_payment_is_hrga()
      )
  )
);

create policy "mob_payment_attachments_update"
on public.mob_payment_attachments
for update to authenticated
using (
  exists (
    select 1
    from public.mob_payment payment
    where payment.id = mob_payment_attachments.payment_id
      and (
        payment.employee_authenticated_id = auth.uid()
        or public.mob_payment_is_hrga()
      )
  )
)
with check (
  exists (
    select 1
    from public.mob_payment payment
    where payment.id = mob_payment_attachments.payment_id
      and (
        payment.employee_authenticated_id = auth.uid()
        or public.mob_payment_is_hrga()
      )
  )
);

create policy "mob_payment_attachments_delete"
on public.mob_payment_attachments
for delete to authenticated
using (
  exists (
    select 1
    from public.mob_payment payment
    where payment.id = mob_payment_attachments.payment_id
      and (
        payment.employee_authenticated_id = auth.uid()
        or public.mob_payment_is_hrga()
      )
  )
);

insert into storage.buckets (id, name, public)
values ('mob-payments', 'mob-payments', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "mob_payment_bucket_select" on storage.objects;
drop policy if exists "mob_payment_bucket_insert" on storage.objects;
drop policy if exists "mob_payment_bucket_update" on storage.objects;
drop policy if exists "mob_payment_bucket_delete" on storage.objects;

create policy "mob_payment_bucket_select"
on storage.objects for select to authenticated
using (bucket_id = 'mob-payments');

create policy "mob_payment_bucket_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'mob-payments');

create policy "mob_payment_bucket_update"
on storage.objects for update to authenticated
using (bucket_id = 'mob-payments')
with check (bucket_id = 'mob-payments');

create policy "mob_payment_bucket_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'mob-payments');

commit;
