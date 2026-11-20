create table if not exists public.inbound_wa_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  inbound_id bigint references public.inbound(id) on update cascade on delete restrict,
  group_id text not null,
  source text not null check (source in ('auto', 'request')),
  request_message_id text,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  target_qty integer,
  intake_qty integer,
  wa_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint inbound_wa_report_delivery_source_check check (
    (source = 'auto' and inbound_id is not null and request_message_id is null)
    or (source = 'request' and request_message_id is not null)
  )
);

create unique index if not exists inbound_wa_report_auto_once_idx
  on public.inbound_wa_report_deliveries (inbound_id, group_id)
  where source = 'auto';

create unique index if not exists inbound_wa_report_request_once_idx
  on public.inbound_wa_report_deliveries (request_message_id)
  where source = 'request';

create index if not exists inbound_wa_report_deliveries_created_idx
  on public.inbound_wa_report_deliveries (created_at desc);

alter table public.inbound_wa_report_deliveries enable row level security;

revoke all on table public.inbound_wa_report_deliveries from public, anon, authenticated;
grant select, insert, update on table public.inbound_wa_report_deliveries to service_role;

drop policy if exists inbound_wa_report_service_role_access
  on public.inbound_wa_report_deliveries;
create policy inbound_wa_report_service_role_access
  on public.inbound_wa_report_deliveries
  for all to service_role using (true) with check (true);
