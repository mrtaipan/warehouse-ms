-- Run this migration before deploying the app changes that remove short polling.
-- It only adds Realtime policies, a trigger function, and triggers; existing data is untouched.

drop policy if exists warehouse_ms_authenticated_realtime_topics on realtime.messages;

create policy warehouse_ms_authenticated_realtime_topics
on realtime.messages
for select
to authenticated
using (
  realtime.topic() in ('warehouse:storage', 'qc:summary')
);

create or replace function public.broadcast_warehouse_ms_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_topic text;
begin
  foreach target_topic in array tg_argv
  loop
    perform realtime.send(
      jsonb_build_object(
        'schema', tg_table_schema,
        'table', tg_table_name,
        'operation', tg_op
      ),
      'changed',
      target_topic,
      true
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.broadcast_warehouse_ms_change() from public, anon, authenticated;

-- Storage Overview sources.
drop trigger if exists warehouse_ms_realtime_broadcast on public.dir_rack_locations;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.dir_rack_locations
for each statement execute function public.broadcast_warehouse_ms_change('warehouse:storage');

drop trigger if exists warehouse_ms_realtime_broadcast on public.warehouse_storage;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.warehouse_storage
for each statement execute function public.broadcast_warehouse_ms_change('warehouse:storage');

drop trigger if exists warehouse_ms_realtime_broadcast on public.restock_request;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.restock_request
for each statement execute function public.broadcast_warehouse_ms_change('warehouse:storage');

drop trigger if exists warehouse_ms_realtime_broadcast on public.pl_packing_items;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.pl_packing_items
for each statement execute function public.broadcast_warehouse_ms_change('warehouse:storage');

-- Shared directory sources notify both modules.
drop trigger if exists warehouse_ms_realtime_broadcast on public.inbound;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.inbound
for each statement execute function public.broadcast_warehouse_ms_change('warehouse:storage', 'qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.dir_user_profiles;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.dir_user_profiles
for each statement execute function public.broadcast_warehouse_ms_change('warehouse:storage', 'qc:summary');

-- QC Summary sources.
drop trigger if exists warehouse_ms_realtime_broadcast on public.qc_items;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.qc_items
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.arkline_qc;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.arkline_qc
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.qc_confirm;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.qc_confirm
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.warehouse_returns;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.warehouse_returns
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.qc_pause_logs;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.qc_pause_logs
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.arkline_qc_reject_reasons;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.arkline_qc_reject_reasons
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.arkline_qc_reject_details;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.arkline_qc_reject_details
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.arkline_qc_reject_adjustments;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.arkline_qc_reject_adjustments
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.arkline_po_item_sizes;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.arkline_po_item_sizes
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.inbound_sample_model_breakdowns;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.inbound_sample_model_breakdowns
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.qc_sample_breakdowns;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.qc_sample_breakdowns
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.inbound_unload;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.inbound_unload
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.dir_brands;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.dir_brands
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.dir_categories;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.dir_categories
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.dir_product_models;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.dir_product_models
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');

drop trigger if exists warehouse_ms_realtime_broadcast on public.dir_user_roles;
create trigger warehouse_ms_realtime_broadcast
after insert or update or delete on public.dir_user_roles
for each statement execute function public.broadcast_warehouse_ms_change('qc:summary');
