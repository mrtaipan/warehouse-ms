begin;

create table if not exists public.product_bundles (
  id bigserial primary key,
  bundle_code text not null,
  bundle_name text not null,
  storing_type text not null,
  bundle_unit_qty integer not null default 1,
  status text not null default 'draft',
  released_at timestamptz null,
  released_by text null,
  release_count integer not null default 0,
  release_history jsonb not null default '[]'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_bundles_code_unique unique (bundle_code),
  constraint product_bundles_type_check check (storing_type in ('MOB', 'OI')),
  constraint product_bundles_status_check check (status in ('draft', 'released', 'cancelled')),
  constraint product_bundles_unit_qty_check check (bundle_unit_qty > 0),
  constraint product_bundles_release_count_check check (release_count >= 0)
);

alter table public.product_bundles
  add column if not exists released_at timestamptz null,
  add column if not exists released_by text null,
  add column if not exists release_count integer not null default 0,
  add column if not exists release_history jsonb not null default '[]'::jsonb;

alter table public.product_bundles
  drop constraint if exists product_bundles_release_count_check;

alter table public.product_bundles
  add constraint product_bundles_release_count_check
  check (release_count >= 0);

create table if not exists public.product_bundle_components (
  id bigserial primary key,
  bundle_id bigint not null references public.product_bundles(id) on delete cascade,
  source_pl_packing_item_id bigint not null references public.pl_packing_items(id) on delete restrict,
  source_type text not null,
  grn_number text null,
  sku text null,
  product_name text null,
  size_label text null,
  allocated_qty integer not null,
  available_qty_snapshot integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_bundle_components_type_check check (source_type in ('MOB', 'OI')),
  constraint product_bundle_components_allocated_qty_check check (allocated_qty > 0)
);

create index if not exists product_bundles_created_at_idx
  on public.product_bundles (created_at desc);

create index if not exists product_bundles_type_status_idx
  on public.product_bundles (storing_type, status);

create index if not exists product_bundle_components_bundle_idx
  on public.product_bundle_components (bundle_id);

create index if not exists product_bundle_components_source_idx
  on public.product_bundle_components (source_pl_packing_item_id);

alter table public.product_bundles enable row level security;
alter table public.product_bundle_components enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.product_bundles to authenticated;
grant select, insert, update on public.product_bundle_components to authenticated;
grant usage, select on sequence public.product_bundles_id_seq to authenticated;
grant usage, select on sequence public.product_bundle_components_id_seq to authenticated;

drop policy if exists product_bundles_authenticated_select
  on public.product_bundles;
drop policy if exists product_bundles_authenticated_insert
  on public.product_bundles;
drop policy if exists product_bundles_authenticated_update
  on public.product_bundles;
drop policy if exists product_bundle_components_authenticated_select
  on public.product_bundle_components;
drop policy if exists product_bundle_components_authenticated_insert
  on public.product_bundle_components;
drop policy if exists product_bundle_components_authenticated_update
  on public.product_bundle_components;

create policy product_bundles_authenticated_select
on public.product_bundles
for select
to authenticated
using (true);

create policy product_bundles_authenticated_insert
on public.product_bundles
for insert
to authenticated
with check (true);

create policy product_bundles_authenticated_update
on public.product_bundles
for update
to authenticated
using (true)
with check (true);

create policy product_bundle_components_authenticated_select
on public.product_bundle_components
for select
to authenticated
using (true);

create policy product_bundle_components_authenticated_insert
on public.product_bundle_components
for insert
to authenticated
with check (true);

create policy product_bundle_components_authenticated_update
on public.product_bundle_components
for update
to authenticated
using (true)
with check (true);

drop function if exists public.create_product_bundle(text, text, text, integer, jsonb, text);
drop function if exists public.add_product_bundle_components(bigint, jsonb, text);

create or replace function public.create_product_bundle(
  p_bundle_code text,
  p_bundle_name text,
  p_storing_type text,
  p_bundle_unit_qty integer,
  p_components jsonb,
  p_actor text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_bundle public.product_bundles%rowtype;
  v_storing_type text := upper(trim(coalesce(p_storing_type, '')));
  v_unit_qty integer := greatest(coalesce(p_bundle_unit_qty, 1), 1);
begin
  if nullif(trim(coalesce(p_bundle_code, '')), '') is null then
    raise exception 'Bundle code is required.';
  end if;

  if nullif(trim(coalesce(p_bundle_name, '')), '') is null then
    raise exception 'Bundle name is required.';
  end if;

  if v_storing_type not in ('MOB', 'OI') then
    raise exception 'Bundle group must be MOB or OI.';
  end if;

  if p_components is null or jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) = 0 then
    raise exception 'At least one bundle component is required.';
  end if;

  insert into public.product_bundles (
    bundle_code,
    bundle_name,
    storing_type,
    bundle_unit_qty,
    status,
    created_by
  )
  values (
    upper(trim(p_bundle_code)),
    upper(trim(p_bundle_name)),
    v_storing_type,
    v_unit_qty,
    'draft',
    p_actor
  )
  returning * into v_bundle;

  insert into public.product_bundle_components (
    bundle_id,
    source_pl_packing_item_id,
    source_type,
    grn_number,
    sku,
    product_name,
    size_label,
    allocated_qty,
    available_qty_snapshot
  )
  select
    v_bundle.id,
    (component ->> 'source_pl_packing_item_id')::bigint,
    upper(trim(component ->> 'source_type')),
    nullif(trim(component ->> 'grn_number'), ''),
    nullif(trim(component ->> 'sku'), ''),
    nullif(trim(component ->> 'product_name'), ''),
    nullif(trim(component ->> 'size_label'), ''),
    (component ->> 'allocated_qty')::integer,
    coalesce((component ->> 'available_qty_snapshot')::integer, 0)
  from jsonb_array_elements(p_components) as component;

  return jsonb_build_object(
    'bundle', to_jsonb(v_bundle)
  );
end;
$$;

grant execute on function public.create_product_bundle(text, text, text, integer, jsonb, text) to authenticated;

create or replace function public.add_product_bundle_components(
  p_bundle_id bigint,
  p_components jsonb,
  p_actor text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_bundle public.product_bundles%rowtype;
begin
  select *
    into v_bundle
  from public.product_bundles
  where id = p_bundle_id
  for update;

  if not found then
    raise exception 'Bundle % was not found.', p_bundle_id;
  end if;

  if v_bundle.status <> 'draft' then
    raise exception 'Only draft bundles can receive new components.';
  end if;

  if p_components is null or jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) = 0 then
    raise exception 'At least one bundle component is required.';
  end if;

  insert into public.product_bundle_components (
    bundle_id,
    source_pl_packing_item_id,
    source_type,
    grn_number,
    sku,
    product_name,
    size_label,
    allocated_qty,
    available_qty_snapshot
  )
  select
    v_bundle.id,
    (component ->> 'source_pl_packing_item_id')::bigint,
    upper(trim(component ->> 'source_type')),
    nullif(trim(component ->> 'grn_number'), ''),
    nullif(trim(component ->> 'sku'), ''),
    nullif(trim(component ->> 'product_name'), ''),
    nullif(trim(component ->> 'size_label'), ''),
    (component ->> 'allocated_qty')::integer,
    coalesce((component ->> 'available_qty_snapshot')::integer, 0)
  from jsonb_array_elements(p_components) as component;

  update public.product_bundles
  set updated_at = now()
  where id = v_bundle.id
  returning * into v_bundle;

  return jsonb_build_object(
    'bundle', to_jsonb(v_bundle)
  );
end;
$$;

grant execute on function public.add_product_bundle_components(bigint, jsonb, text) to authenticated;

comment on table public.product_bundles is
  'Draft/released product bundle headers built from Product Directory rows.';

comment on table public.product_bundle_components is
  'Component allocation rows for product bundles. Source PL rows remain unchanged.';

comment on function public.create_product_bundle(text, text, text, integer, jsonb, text) is
  'Creates a product bundle draft and its component allocation rows in one transaction.';

comment on function public.add_product_bundle_components(bigint, jsonb, text) is
  'Adds component allocation rows to an existing draft product bundle in one transaction.';

notify pgrst, 'reload schema';

commit;
