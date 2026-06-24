begin;

alter table public.dir_user_profiles
  add column if not exists reimbursement_bank_name text,
  add column if not exists reimbursement_account_name text,
  add column if not exists reimbursement_account_number text;

create table if not exists public.dir_reimbursement_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.generate_arkline_reimbursement_claim_number()
returns text
language plpgsql
as $$
declare
  month_number int;
  month_roman text;
  year_text text;
  prefix_text text;
  next_number int;
begin
  month_number := extract(month from now());
  year_text := to_char(now(), 'YYYY');
  month_roman := case month_number
    when 1 then 'I'
    when 2 then 'II'
    when 3 then 'III'
    when 4 then 'IV'
    when 5 then 'V'
    when 6 then 'VI'
    when 7 then 'VII'
    when 8 then 'VIII'
    when 9 then 'IX'
    when 10 then 'X'
    when 11 then 'XI'
    when 12 then 'XII'
  end;

  prefix_text := 'RC-' || month_roman || year_text || '-';

  perform pg_advisory_xact_lock(hashtext(prefix_text));

  select coalesce(max(right(claim_number, 3)::int), 0) + 1
    into next_number
  from public.arkline_reimbursement_claims
  where claim_number like prefix_text || '%';

  return prefix_text || lpad(next_number::text, 3, '0');
end;
$$;

create table if not exists public.arkline_reimbursement_claims (
  id bigint generated always as identity primary key,
  claim_number text not null unique default public.generate_arkline_reimbursement_claim_number(),
  employee_authenticated_id uuid references auth.users(id) on delete set null,
  employee_email_snapshot text not null,
  employee_name_snapshot text,
  expense_date date not null,
  expense_category_id bigint not null references public.dir_reimbursement_categories(id),
  status text not null default 'SUBMITTED',
  description text,
  total_amount numeric(18,2) not null default 0,
  payee_type text not null default 'SELF_ACCOUNT',
  payee_authenticated_id uuid references auth.users(id) on delete set null,
  payee_bank_name text,
  payee_account_name text,
  payee_account_number text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  created_by text,
  approved_by text,
  paid_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_reimbursement_claim_status_check check (status in ('SUBMITTED', 'APPROVED', 'PAID')),
  constraint arkline_reimbursement_claim_payee_type_check check (payee_type in ('SELF_ACCOUNT', 'OTHER_ACCOUNT')),
  constraint arkline_reimbursement_claim_total_amount_check check (total_amount >= 0),
  constraint arkline_reimbursement_claim_other_account_check check (
    payee_type = 'SELF_ACCOUNT'
    or (coalesce(trim(payee_account_name), '') <> '' and coalesce(trim(payee_account_number), '') <> '')
  )
);

create table if not exists public.arkline_reimbursement_attachments (
  id bigint generated always as identity primary key,
  claim_id bigint not null references public.arkline_reimbursement_claims(id) on delete cascade,
  attachment_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by text,
  created_at timestamptz not null default now(),
  constraint arkline_reimbursement_attachment_type_check check (attachment_type in ('SUBMISSION_PROOF', 'PAYMENT_PROOF'))
);

create index if not exists idx_dir_reimbursement_categories_active
  on public.dir_reimbursement_categories (is_active, name);

create index if not exists idx_arkline_reimbursement_claims_status
  on public.arkline_reimbursement_claims (status, submitted_at asc);

create index if not exists idx_arkline_reimbursement_claims_employee
  on public.arkline_reimbursement_claims (employee_authenticated_id, submitted_at asc);

create index if not exists idx_arkline_reimbursement_claims_category
  on public.arkline_reimbursement_claims (expense_category_id);

create index if not exists idx_arkline_reimbursement_attachments_claim
  on public.arkline_reimbursement_attachments (claim_id, attachment_type, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.reimbursement_is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_email() = 'mr.peneliti@gmail.com';
$$;

create or replace function public.reimbursement_has_permission(target_code text)
returns boolean
language sql
stable
as $$
  select
    public.reimbursement_is_admin()
    or exists (
      select 1
      from public.dir_user_profiles profile
      join public.dir_user_roles role_map
        on role_map.role = profile.role
      where lower(profile.email) = public.current_user_email()
        and role_map.permission_code = target_code
    );
$$;

create or replace function public.reimbursement_is_claim_owner(created_by_value text, employee_email_value text)
returns boolean
language sql
stable
as $$
  select public.current_user_email() in (
    lower(coalesce(created_by_value, '')),
    lower(coalesce(employee_email_value, ''))
  );
$$;

drop trigger if exists trg_dir_reimbursement_categories_updated_at on public.dir_reimbursement_categories;
create trigger trg_dir_reimbursement_categories_updated_at
before update on public.dir_reimbursement_categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_arkline_reimbursement_claims_updated_at on public.arkline_reimbursement_claims;
create trigger trg_arkline_reimbursement_claims_updated_at
before update on public.arkline_reimbursement_claims
for each row execute function public.set_updated_at();

alter table public.dir_reimbursement_categories enable row level security;
alter table public.arkline_reimbursement_claims enable row level security;
alter table public.arkline_reimbursement_attachments enable row level security;

drop policy if exists "authenticated_select_dir_reimbursement_categories" on public.dir_reimbursement_categories;
drop policy if exists "authenticated_insert_dir_reimbursement_categories" on public.dir_reimbursement_categories;
drop policy if exists "authenticated_update_dir_reimbursement_categories" on public.dir_reimbursement_categories;
drop policy if exists "authenticated_delete_dir_reimbursement_categories" on public.dir_reimbursement_categories;
create policy "authenticated_select_dir_reimbursement_categories" on public.dir_reimbursement_categories for select to authenticated using (true);
create policy "authenticated_insert_dir_reimbursement_categories" on public.dir_reimbursement_categories for insert to authenticated with check (true);
create policy "authenticated_update_dir_reimbursement_categories" on public.dir_reimbursement_categories for update to authenticated using (true) with check (true);
create policy "authenticated_delete_dir_reimbursement_categories" on public.dir_reimbursement_categories for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_reimbursement_claims" on public.arkline_reimbursement_claims;
drop policy if exists "authenticated_insert_arkline_reimbursement_claims" on public.arkline_reimbursement_claims;
drop policy if exists "authenticated_update_arkline_reimbursement_claims" on public.arkline_reimbursement_claims;
drop policy if exists "authenticated_delete_arkline_reimbursement_claims" on public.arkline_reimbursement_claims;
create policy "authenticated_select_arkline_reimbursement_claims" on public.arkline_reimbursement_claims for select to authenticated
using (
  status <> 'SUBMITTED'
  or public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
  or public.reimbursement_is_admin()
);
create policy "authenticated_insert_arkline_reimbursement_claims" on public.arkline_reimbursement_claims for insert to authenticated
with check (
  public.reimbursement_has_permission('arkline.finance.reimbursement.submit')
  and public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  and status = 'SUBMITTED'
);
create policy "authenticated_update_arkline_reimbursement_claims" on public.arkline_reimbursement_claims for update to authenticated
using (
  public.reimbursement_is_admin()
  or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
  or public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
  or (
    status = 'SUBMITTED'
    and public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  )
)
with check (
  public.reimbursement_is_admin()
  or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
  or public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
  or (
    status = 'SUBMITTED'
    and public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  )
);
create policy "authenticated_delete_arkline_reimbursement_claims" on public.arkline_reimbursement_claims for delete to authenticated
using (
  public.reimbursement_is_admin()
  or (
    status = 'SUBMITTED'
    and public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  )
);

drop policy if exists "authenticated_select_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments;
drop policy if exists "authenticated_insert_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments;
drop policy if exists "authenticated_update_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments;
drop policy if exists "authenticated_delete_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments;
create policy "authenticated_select_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments for select to authenticated
using (
  exists (
    select 1
    from public.arkline_reimbursement_claims claim_row
    where claim_row.id = claim_id
      and (
        claim_row.status <> 'SUBMITTED'
        or public.reimbursement_is_claim_owner(claim_row.created_by, claim_row.employee_email_snapshot)
        or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
        or public.reimbursement_is_admin()
      )
  )
);
create policy "authenticated_insert_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments for insert to authenticated
with check (
  exists (
    select 1
    from public.arkline_reimbursement_claims claim_row
    where claim_row.id = claim_id
      and (
        public.reimbursement_is_admin()
        or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
        or (
          attachment_type = 'PAYMENT_PROOF'
          and claim_row.status = 'APPROVED'
          and public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
        )
        or (
          attachment_type = 'SUBMISSION_PROOF'
          and claim_row.status = 'SUBMITTED'
          and public.reimbursement_is_claim_owner(claim_row.created_by, claim_row.employee_email_snapshot)
        )
      )
  )
);
create policy "authenticated_update_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments for update to authenticated
using (public.reimbursement_is_admin())
with check (public.reimbursement_is_admin());
create policy "authenticated_delete_arkline_reimbursement_attachments" on public.arkline_reimbursement_attachments for delete to authenticated
using (
  public.reimbursement_is_admin()
  or exists (
    select 1
    from public.arkline_reimbursement_claims claim_row
    where claim_row.id = claim_id
      and claim_row.status = 'SUBMITTED'
      and attachment_type = 'SUBMISSION_PROOF'
      and public.reimbursement_is_claim_owner(claim_row.created_by, claim_row.employee_email_snapshot)
  )
);

insert into public.dir_reimbursement_categories (name, is_active)
values
  ('TRANSPORT', true),
  ('MEAL', true),
  ('SUPPLIES', true),
  ('DELIVERY', true),
  ('GARMENT PRODUCTION', true),
  ('MATERIAL PROCUREMENT', true),
  ('OTHER', true)
on conflict (name) do update
set is_active = excluded.is_active;

insert into public.dir_user_permissions (code, label, description)
values
  ('arkline.finance.reimbursement.view', 'View reimbursement claims', 'See reimbursement claim list and claim detail inside Arkline financial management.'),
  ('arkline.finance.reimbursement.submit', 'Submit reimbursement claims', 'Create reimbursement claims and upload submission attachments.'),
  ('arkline.finance.reimbursement.approve', 'Approve reimbursement claims', 'Move reimbursement claims from Submitted to Approved.'),
  ('arkline.finance.reimbursement.pay', 'Pay reimbursement claims', 'Mark approved reimbursement claims as Paid and upload payment proof.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into storage.buckets (id, name, public)
values ('reimbursement-claims', 'reimbursement-claims', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "authenticated_select_reimbursement_claims_bucket" on storage.objects;
drop policy if exists "authenticated_insert_reimbursement_claims_bucket" on storage.objects;
drop policy if exists "authenticated_update_reimbursement_claims_bucket" on storage.objects;
drop policy if exists "authenticated_delete_reimbursement_claims_bucket" on storage.objects;
create policy "authenticated_select_reimbursement_claims_bucket"
on storage.objects for select to authenticated
using (
  bucket_id = 'reimbursement-claims'
  and exists (
    select 1
    from public.arkline_reimbursement_attachments attachment
    join public.arkline_reimbursement_claims claim_row
      on claim_row.id = attachment.claim_id
    where attachment.storage_bucket = bucket_id
      and attachment.storage_path = name
      and (
        claim_row.status <> 'SUBMITTED'
        or public.reimbursement_is_claim_owner(claim_row.created_by, claim_row.employee_email_snapshot)
        or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
        or public.reimbursement_is_admin()
      )
  )
);
create policy "authenticated_insert_reimbursement_claims_bucket"
on storage.objects for insert to authenticated
with check (bucket_id = 'reimbursement-claims');
create policy "authenticated_update_reimbursement_claims_bucket"
on storage.objects for update to authenticated
using (bucket_id = 'reimbursement-claims')
with check (bucket_id = 'reimbursement-claims');
create policy "authenticated_delete_reimbursement_claims_bucket"
on storage.objects for delete to authenticated
using (bucket_id = 'reimbursement-claims');

commit;
