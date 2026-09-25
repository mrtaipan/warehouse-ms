create sequence if not exists public.warehouse_reject_storage_id_seq;
create sequence if not exists public.warehouse_reject_storage_koli_seq;

create table if not exists public.warehouse_reject_storage (
  id bigint primary key default nextval('public.warehouse_reject_storage_id_seq'::regclass),
  koli_number text not null default ('R-' || lpad(nextval('public.warehouse_reject_storage_koli_seq')::text, 3, '0')),
  product_name text not null,
  size text not null,
  category_id bigint not null references public.dir_categories(id),
  sub_category_id bigint not null references public.dir_categories(id),
  item_type_id bigint null references public.dir_categories(id),
  qty integer not null,
  grade text not null,
  reject_note text not null,
  status text not null default 'DRAFT',
  posted_at timestamptz null,
  posted_by text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_by text null,
  updated_at timestamptz not null default now()
);

alter table public.warehouse_reject_storage
  add column if not exists id bigint,
  add column if not exists koli_number text,
  add column if not exists product_name text,
  add column if not exists size text,
  add column if not exists category_id bigint,
  add column if not exists sub_category_id bigint,
  add column if not exists item_type_id bigint,
  add column if not exists qty integer,
  add column if not exists grade text,
  add column if not exists reject_note text,
  add column if not exists status text,
  add column if not exists posted_at timestamptz,
  add column if not exists posted_by text,
  add column if not exists created_by text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_by text,
  add column if not exists updated_at timestamptz;

alter table public.warehouse_reject_storage
  alter column id set default nextval('public.warehouse_reject_storage_id_seq'::regclass);

with reject_id_sequence as (
  select max(id) as max_id
  from public.warehouse_reject_storage
)
select setval(
  'public.warehouse_reject_storage_id_seq',
  greatest(1, coalesce(max_id, 1)),
  max_id is not null
)
from reject_id_sequence;

update public.warehouse_reject_storage
set id = nextval('public.warehouse_reject_storage_id_seq'::regclass)
where id is null;

alter table public.warehouse_reject_storage
  alter column id set not null;

alter sequence public.warehouse_reject_storage_id_seq
  owned by public.warehouse_reject_storage.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.warehouse_reject_storage'::regclass
      and contype = 'p'
  ) then
    alter table public.warehouse_reject_storage
      add constraint warehouse_reject_storage_pkey primary key (id);
  end if;
end $$;

alter table public.warehouse_reject_storage
  alter column koli_number set default ('R-' || lpad(nextval('public.warehouse_reject_storage_koli_seq')::text, 3, '0'));

alter table public.warehouse_reject_storage
  alter column status set default 'DRAFT';

alter table public.warehouse_reject_storage
  alter column created_at set default now();

alter table public.warehouse_reject_storage
  alter column updated_at set default now();

alter table public.warehouse_reject_storage
  alter column item_type_id drop not null;

alter table public.warehouse_reject_storage
  drop constraint if exists warehouse_reject_storage_koli_number_key;

with reject_koli_sequence as (
  select max((regexp_match(koli_number, '^R(?:JK)?-(\d+)$'))[1]::bigint) as max_sequence
  from public.warehouse_reject_storage
  where koli_number ~ '^R(?:JK)?-\d+$'
)
select setval(
  'public.warehouse_reject_storage_koli_seq',
  greatest(1, coalesce(max_sequence, 1)),
  max_sequence is not null
)
from reject_koli_sequence;

alter table public.warehouse_reject_storage
  drop constraint if exists warehouse_reject_storage_qty_check;

alter table public.warehouse_reject_storage
  add constraint warehouse_reject_storage_qty_check check (qty > 0);

alter table public.warehouse_reject_storage
  drop constraint if exists warehouse_reject_storage_grade_check;

alter table public.warehouse_reject_storage
  add constraint warehouse_reject_storage_grade_check check (grade in ('B', 'C'));

alter table public.warehouse_reject_storage
  drop constraint if exists warehouse_reject_storage_status_check;

alter table public.warehouse_reject_storage
  add constraint warehouse_reject_storage_status_check check (status in ('DRAFT', 'POSTED'));

create index if not exists warehouse_reject_storage_status_created_at_idx
  on public.warehouse_reject_storage (status, created_at desc);

create index if not exists warehouse_reject_storage_koli_number_idx
  on public.warehouse_reject_storage (koli_number);

create index if not exists warehouse_reject_storage_category_idx
  on public.warehouse_reject_storage (category_id, sub_category_id, item_type_id);

alter table public.warehouse_reject_storage enable row level security;

grant usage on schema public to authenticated;
grant usage, select on sequence public.warehouse_reject_storage_id_seq to authenticated;
grant usage, select on sequence public.warehouse_reject_storage_koli_seq to authenticated;
grant select, insert, update on public.warehouse_reject_storage to authenticated;

drop policy if exists warehouse_reject_storage_authenticated_select on public.warehouse_reject_storage;
drop policy if exists warehouse_reject_storage_authenticated_insert on public.warehouse_reject_storage;
drop policy if exists warehouse_reject_storage_authenticated_update on public.warehouse_reject_storage;

create policy warehouse_reject_storage_authenticated_select
on public.warehouse_reject_storage
for select
to authenticated
using (true);

create policy warehouse_reject_storage_authenticated_insert
on public.warehouse_reject_storage
for insert
to authenticated
with check (status = 'DRAFT');

create policy warehouse_reject_storage_authenticated_update
on public.warehouse_reject_storage
for update
to authenticated
using (status = 'DRAFT')
with check (status in ('DRAFT', 'POSTED'));

comment on table public.warehouse_reject_storage is
  'Draft and posted reject storage koli records. Draft rows remain editable until posted.';

notify pgrst, 'reload schema';
