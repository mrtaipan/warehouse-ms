begin;

create table if not exists public.arkline_payment (
  id bigint generated always as identity primary key,
  payment_basis text not null default 'NON_PO_BASED',
  po_source_type text,
  po_db_id bigint,
  po_number text,
  supplier_name_snapshot text,
  invoice_number text not null,
  category_id bigint references public.dir_reimbursement_categories(id),
  amount numeric(18,2) not null default 0,
  notes text,
  account_name text not null,
  bank_name text not null,
  account_number text not null,
  status text not null default 'SUBMITTED',
  created_by text,
  approved_by text,
  approved_at timestamptz,
  paid_by text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_payment_basis_check check (payment_basis in ('PO_BASED', 'NON_PO_BASED')),
  constraint arkline_payment_po_source_type_check check (po_source_type is null or po_source_type in ('GARMENT', 'MATERIAL')),
  constraint arkline_payment_status_check check (status in ('SUBMITTED', 'NEED_REVISION', 'APPROVED', 'PAID')),
  constraint arkline_payment_amount_check check (amount >= 0)
);

alter table public.arkline_payment
  add column if not exists po_source_type text,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'arkline_payment_po_source_type_check'
      and conrelid = 'public.arkline_payment'::regclass
  ) then
    alter table public.arkline_payment
      add constraint arkline_payment_po_source_type_check
      check (po_source_type is null or po_source_type in ('GARMENT', 'MATERIAL'));
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'arkline_payment_status_check'
      and conrelid = 'public.arkline_payment'::regclass
  ) then
    alter table public.arkline_payment
      drop constraint arkline_payment_status_check;
  end if;

  alter table public.arkline_payment
    add constraint arkline_payment_status_check
    check (status in ('SUBMITTED', 'NEED_REVISION', 'APPROVED', 'PAID'));
end
$$;

create table if not exists public.arkline_payment_attachments (
  id bigint generated always as identity primary key,
  payment_id bigint not null references public.arkline_payment(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_arkline_payment_status
  on public.arkline_payment (status, created_at asc);

create index if not exists idx_arkline_payment_invoice
  on public.arkline_payment (invoice_number);

create index if not exists idx_arkline_payment_basis
  on public.arkline_payment (payment_basis, created_at asc);

create index if not exists idx_arkline_payment_category
  on public.arkline_payment (category_id);

create index if not exists idx_arkline_payment_attachments_payment
  on public.arkline_payment_attachments (payment_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_arkline_payment_updated_at on public.arkline_payment;
create trigger trg_arkline_payment_updated_at
before update on public.arkline_payment
for each row execute function public.set_updated_at();

alter table public.arkline_payment enable row level security;
alter table public.arkline_payment_attachments enable row level security;

drop policy if exists "authenticated_select_arkline_payment" on public.arkline_payment;
drop policy if exists "authenticated_insert_arkline_payment" on public.arkline_payment;
drop policy if exists "authenticated_update_arkline_payment" on public.arkline_payment;
drop policy if exists "authenticated_delete_arkline_payment" on public.arkline_payment;
create policy "authenticated_select_arkline_payment" on public.arkline_payment for select to authenticated using (true);
create policy "authenticated_insert_arkline_payment" on public.arkline_payment for insert to authenticated with check (true);
create policy "authenticated_update_arkline_payment" on public.arkline_payment for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_payment" on public.arkline_payment for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_payment_attachments" on public.arkline_payment_attachments;
drop policy if exists "authenticated_insert_arkline_payment_attachments" on public.arkline_payment_attachments;
drop policy if exists "authenticated_update_arkline_payment_attachments" on public.arkline_payment_attachments;
drop policy if exists "authenticated_delete_arkline_payment_attachments" on public.arkline_payment_attachments;
create policy "authenticated_select_arkline_payment_attachments" on public.arkline_payment_attachments for select to authenticated using (true);
create policy "authenticated_insert_arkline_payment_attachments" on public.arkline_payment_attachments for insert to authenticated with check (true);
create policy "authenticated_update_arkline_payment_attachments" on public.arkline_payment_attachments for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_payment_attachments" on public.arkline_payment_attachments for delete to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('arkline-payments', 'arkline-payments', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "authenticated_select_arkline_payment_bucket" on storage.objects;
drop policy if exists "authenticated_insert_arkline_payment_bucket" on storage.objects;
drop policy if exists "authenticated_update_arkline_payment_bucket" on storage.objects;
drop policy if exists "authenticated_delete_arkline_payment_bucket" on storage.objects;
create policy "authenticated_select_arkline_payment_bucket"
on storage.objects for select to authenticated
using (bucket_id = 'arkline-payments');
create policy "authenticated_insert_arkline_payment_bucket"
on storage.objects for insert to authenticated
with check (bucket_id = 'arkline-payments');
create policy "authenticated_update_arkline_payment_bucket"
on storage.objects for update to authenticated
using (bucket_id = 'arkline-payments')
with check (bucket_id = 'arkline-payments');
create policy "authenticated_delete_arkline_payment_bucket"
on storage.objects for delete to authenticated
using (bucket_id = 'arkline-payments');

commit;
