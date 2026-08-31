-- Lightweight read models to reduce Supabase egress for high-traffic dashboard pages.
-- These views do not mutate existing data.

create or replace view public.warehouse_storage_sku_totals
with (security_invoker = true)
as
select
  nullif(trim(sku_id), '') as sku_id,
  sum(coalesce(qty, 0)) as total_qty
from public.warehouse_storage
where nullif(trim(sku_id), '') is not null
group by nullif(trim(sku_id), '');

create or replace view public.operations_calendar_pl_receiving_daily_summary
with (security_invoker = true)
as
with receiving_events as (
  select
    (created_at at time zone 'Asia/Jakarta')::date as event_date,
    coalesce(received_qty, 0) as received_qty,
    0::numeric as validated_qty,
    1::integer as received_rows,
    0::integer as validated_rows
  from public.pl_receiving
  where created_at is not null

  union all

  select
    (validated_at at time zone 'Asia/Jakarta')::date as event_date,
    0::numeric as received_qty,
    coalesce(received_qty, 0) as validated_qty,
    0::integer as received_rows,
    1::integer as validated_rows
  from public.pl_receiving
  where validated_at is not null
)
select
  event_date,
  sum(received_qty) as received_qty,
  sum(validated_qty) as validated_qty,
  sum(received_rows)::integer as received_rows,
  sum(validated_rows)::integer as validated_rows
from receiving_events
where event_date is not null
group by event_date;

create or replace view public.operations_calendar_pl_breakdown_daily_summary
with (security_invoker = true)
as
select
  (coalesce(psb.updated_at, psb.created_at) at time zone 'Asia/Jakarta')::date as event_date,
  count(*)::integer as line_count,
  coalesce(sum(psb.qty), 0) as breakdown_qty,
  count(distinct psb.inbound_id)::integer as grn_count,
  array_remove(array_agg(distinct nullif(trim(coalesce(i.grn_number, psb.inbound_id::text)), '')), null) as grn_numbers,
  array_remove(array_agg(distinct nullif(trim(i.item_name), '')), null) as item_names
from public.pl_size_breakdown psb
left join public.inbound i on i.id = psb.inbound_id
where coalesce(psb.updated_at, psb.created_at) is not null
group by (coalesce(psb.updated_at, psb.created_at) at time zone 'Asia/Jakarta')::date;

create or replace view public.operations_calendar_storage_daily_summary
with (security_invoker = true)
as
select
  (created_at at time zone 'Asia/Jakarta')::date as event_date,
  count(*)::integer as storage_line_count,
  coalesce(sum(qty), 0) as stored_qty,
  count(distinct nullif(
    upper(trim(coalesce(substring(notes from '[Ss]tored[[:space:]]+[Ff]rom[[:space:]]+([^|/]+)'), ''))),
    ''
  ))::integer as storage_k_count
from public.warehouse_storage
where created_at is not null
group by (created_at at time zone 'Asia/Jakarta')::date;

create or replace view public.operations_calendar_restock_daily_summary
with (security_invoker = true)
as
select
  (coalesce(completed_at, created_at) at time zone 'Asia/Jakarta')::date as event_date,
  count(*)::integer as completed_request_count,
  coalesce(sum(qty), 0) as picked_qty
from public.restock_request
where lower(coalesce(request_status, '')) = 'completed'
  and coalesce(completed_at, created_at) is not null
group by (coalesce(completed_at, created_at) at time zone 'Asia/Jakarta')::date;

grant select on public.warehouse_storage_sku_totals to authenticated;
grant select on public.operations_calendar_pl_receiving_daily_summary to authenticated;
grant select on public.operations_calendar_pl_breakdown_daily_summary to authenticated;
grant select on public.operations_calendar_storage_daily_summary to authenticated;
grant select on public.operations_calendar_restock_daily_summary to authenticated;
