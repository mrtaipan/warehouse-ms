begin;

create table if not exists public.dir_product_model_variant_release_states (
  id bigserial primary key,
  product_model_variant_id bigint not null references public.dir_product_model_variants(id) on update cascade on delete cascade,
  storing_type text not null,
  release_status text not null default 'draft',
  released_at timestamp with time zone null,
  released_by text null,
  release_count integer not null default 0,
  release_history jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.dir_product_model_variant_release_states
  alter column release_status set default 'draft';

alter table public.dir_product_model_variant_release_states
  alter column release_count set default 0;

alter table public.dir_product_model_variant_release_states
  alter column release_history set default '[]'::jsonb;

update public.dir_product_model_variant_release_states
set
  storing_type = upper(trim(storing_type)),
  release_status = coalesce(nullif(trim(release_status), ''), 'draft'),
  release_count = coalesce(release_count, 0),
  release_history = coalesce(release_history, '[]'::jsonb),
  updated_at = coalesce(updated_at, now())
where storing_type <> upper(trim(storing_type))
   or release_status is null
   or trim(release_status) = ''
   or release_count is null
   or release_history is null
   or updated_at is null;

delete from public.dir_product_model_variant_release_states
where product_model_variant_id is null
   or storing_type not in ('MOB', 'OI');

alter table public.dir_product_model_variant_release_states
  drop constraint if exists dir_product_model_variant_release_states_type_check;

alter table public.dir_product_model_variant_release_states
  add constraint dir_product_model_variant_release_states_type_check
  check (storing_type in ('MOB', 'OI'));

alter table public.dir_product_model_variant_release_states
  drop constraint if exists dir_product_model_variant_release_states_status_check;

alter table public.dir_product_model_variant_release_states
  add constraint dir_product_model_variant_release_states_status_check
  check (release_status in ('draft', 'released'));

alter table public.dir_product_model_variant_release_states
  drop constraint if exists dir_product_model_variant_release_states_count_check;

alter table public.dir_product_model_variant_release_states
  add constraint dir_product_model_variant_release_states_count_check
  check (release_count >= 0);

alter table public.dir_product_model_variant_release_states
  drop constraint if exists dir_product_model_variant_release_states_history_check;

alter table public.dir_product_model_variant_release_states
  add constraint dir_product_model_variant_release_states_history_check
  check (jsonb_typeof(release_history) = 'array');

create unique index if not exists dir_product_model_variant_release_states_variant_type_uidx
  on public.dir_product_model_variant_release_states (product_model_variant_id, storing_type);

create index if not exists dir_product_model_variant_release_states_status_idx
  on public.dir_product_model_variant_release_states (storing_type, release_status, product_model_variant_id);

insert into public.dir_product_model_variant_release_states as states (
  product_model_variant_id,
  storing_type
)
select distinct
  product_model_variant_id,
  upper(storing_type) as storing_type
from public.pl_packing_items
where product_model_variant_id is not null
  and upper(storing_type) in ('MOB', 'OI')
on conflict (product_model_variant_id, storing_type) do nothing;

with batch_release_events as (
  select
    items.product_model_variant_id,
    upper(items.storing_type) as storing_type,
    coalesce(items.released_at, items.updated_at, items.created_at, now()) as released_at,
    nullif(trim(items.released_by), '') as released_by,
    sum(items.qty) as qty,
    array_remove(array_agg(distinct inbound.grn_number), null) as grns,
    array_agg(items.id order by items.id) as pl_packing_item_ids
  from public.pl_packing_items items
  left join public.inbound inbound
    on inbound.id = items.inbound_id
  where items.product_model_variant_id is not null
    and upper(items.storing_type) in ('MOB', 'OI')
    and items.release_status = 'released'
  group by
    items.product_model_variant_id,
    upper(items.storing_type),
    coalesce(items.released_at, items.updated_at, items.created_at, now()),
    nullif(trim(items.released_by), '')
),
numbered_release_events as (
  select
    *,
    row_number() over (
      partition by product_model_variant_id, storing_type
      order by released_at, released_by nulls last
    ) as release_sequence
  from batch_release_events
),
release_summary as (
  select
    product_model_variant_id,
    storing_type,
    count(*)::integer as release_count,
    max(released_at) as released_at,
    (array_agg(released_by order by released_at desc nulls last))[1] as released_by,
    jsonb_agg(
      jsonb_build_object(
        'release_count', release_sequence,
        'released_at', released_at,
        'released_by', released_by,
        'storing_type', storing_type,
        'qty', qty,
        'grns', grns,
        'pl_packing_item_ids', pl_packing_item_ids
      )
      order by released_at
    ) as release_history
  from numbered_release_events
  group by product_model_variant_id, storing_type
)
insert into public.dir_product_model_variant_release_states as states (
  product_model_variant_id,
  storing_type,
  release_status,
  released_at,
  released_by,
  release_count,
  release_history,
  updated_at
)
select
  product_model_variant_id,
  storing_type,
  'released',
  released_at,
  released_by,
  release_count,
  release_history,
  coalesce(released_at, now())
from release_summary
on conflict (product_model_variant_id, storing_type) do update
set
  release_status = 'released',
  released_at = coalesce(states.released_at, excluded.released_at),
  released_by = coalesce(states.released_by, excluded.released_by),
  release_count = greatest(coalesce(states.release_count, 0), excluded.release_count),
  release_history = case
    when states.release_history is null then excluded.release_history
    when jsonb_typeof(states.release_history) <> 'array' then excluded.release_history
    when jsonb_array_length(states.release_history) = 0 then excluded.release_history
    else states.release_history
  end,
  updated_at = greatest(
    coalesce(states.updated_at, '-infinity'::timestamp with time zone),
    coalesce(excluded.released_at, now())
  );

alter table public.dir_product_model_variant_release_states enable row level security;

drop policy if exists "Allow all product variant release states select" on public.dir_product_model_variant_release_states;
drop policy if exists "Allow all product variant release states insert" on public.dir_product_model_variant_release_states;
drop policy if exists "Allow all product variant release states update" on public.dir_product_model_variant_release_states;
drop policy if exists "Allow all product variant release states delete" on public.dir_product_model_variant_release_states;

create policy "Allow all product variant release states select"
  on public.dir_product_model_variant_release_states for select
  using (true);

create policy "Allow all product variant release states insert"
  on public.dir_product_model_variant_release_states for insert
  with check (true);

create policy "Allow all product variant release states update"
  on public.dir_product_model_variant_release_states for update
  using (true)
  with check (true);

create policy "Allow all product variant release states delete"
  on public.dir_product_model_variant_release_states for delete
  using (true);

comment on table public.dir_product_model_variant_release_states is
  'Type-specific master release state for regular product variants. One SKU can have separate MOB and OI release status and history.';

comment on column public.dir_product_model_variant_release_states.product_model_variant_id is
  'Regular product variant/SKU from dir_product_model_variants.';

comment on column public.dir_product_model_variant_release_states.storing_type is
  'Release type for this SKU: MOB or OI.';

comment on column public.dir_product_model_variant_release_states.release_history is
  'Release action history for this SKU and storing type. Each entry captures timestamp, actor, qty, GRN list, and PL batch rows where available.';

commit;
