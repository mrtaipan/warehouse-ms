-- Run after warehouse_qc_realtime_broadcast.sql.
-- This migration only adds Realtime authorization and triggers; existing rows are untouched.

drop policy if exists warehouse_ms_authenticated_realtime_topics on realtime.messages;

create policy warehouse_ms_authenticated_realtime_topics
on realtime.messages
for select
to authenticated
using (
  realtime.topic() in (
    'warehouse:storage',
    'warehouse:restock',
    'qc:summary',
    'qc:confirmation',
    'finance:reimbursement',
    'finance:mob-payment',
    'finance:arkline-payment',
    'hr:dashboard'
  )
  or realtime.topic() like 'inbound:unload:%'
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

-- One compact event per SQL statement, including bulk updates/inserts.
do $$
declare
  item record;
  target_table regclass;
  topic_arguments text;
begin
  for item in
    select *
    from (
      values
        ('restock_request', array['warehouse:restock']::text[]),
        ('qc_items', array['qc:confirmation']::text[]),
        ('qc_sample_breakdowns', array['qc:confirmation']::text[]),
        ('qc_confirm', array['qc:confirmation']::text[]),
        ('warehouse_returns', array['qc:confirmation']::text[]),
        ('hrga_reimbursement_claims', array['finance:reimbursement']::text[]),
        ('hrga_reimbursement_attachments', array['finance:reimbursement']::text[]),
        ('arkline_reimbursement_claims', array['finance:reimbursement']::text[]),
        ('arkline_reimbursement_attachments', array['finance:reimbursement']::text[]),
        ('mob_payment', array['finance:mob-payment']::text[]),
        ('mob_payment_attachments', array['finance:mob-payment']::text[]),
        ('arkline_payment', array['finance:arkline-payment']::text[]),
        ('arkline_payment_attachments', array['finance:arkline-payment']::text[]),
        ('arkline_pos', array['finance:arkline-payment']::text[]),
        ('arkline_po_material_ordered', array['finance:arkline-payment']::text[]),
        ('dir_reimbursement_categories', array['finance:reimbursement', 'finance:mob-payment', 'finance:arkline-payment']::text[]),
        ('hrga_leave_requests', array['hr:dashboard']::text[]),
        ('hrga_birthday_gift', array['hr:dashboard']::text[]),
        ('hrga_public_holidays', array['hr:dashboard']::text[]),
        ('dir_user_profiles', array['qc:confirmation', 'finance:reimbursement', 'finance:mob-payment', 'finance:arkline-payment', 'hr:dashboard']::text[]),
        ('dir_user_roles', array['qc:confirmation', 'finance:reimbursement']::text[])
    ) as configured(table_name, topics)
  loop
    target_table := to_regclass('public.' || item.table_name);

    if target_table is null then
      continue;
    end if;

    select string_agg(quote_literal(topic), ', ')
      into topic_arguments
    from unnest(item.topics) as topics(topic);

    execute format(
      'drop trigger if exists warehouse_ms_phase2_realtime_broadcast on %s',
      target_table
    );
    execute format(
      'create trigger warehouse_ms_phase2_realtime_broadcast after insert or update or delete on %s for each statement execute function public.broadcast_warehouse_ms_change(%s)',
      target_table,
      topic_arguments
    );
  end loop;
end;
$$;

-- Inbound unload uses an inbound-specific topic so one active GRN does not refresh every open unload tab.
create or replace function public.broadcast_warehouse_ms_inbound_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_inbound_id text;
begin
  if tg_op = 'DELETE' then
    target_inbound_id := old.inbound_id::text;
  else
    target_inbound_id := new.inbound_id::text;
  end if;

  if coalesce(target_inbound_id, '') <> '' then
    perform realtime.send(
      jsonb_build_object(
        'schema', tg_table_schema,
        'table', tg_table_name,
        'operation', tg_op
      ),
      'changed',
      'inbound:unload:' || target_inbound_id,
      true
    );
  end if;

  return null;
end;
$$;

revoke all on function public.broadcast_warehouse_ms_inbound_change() from public, anon, authenticated;

do $$
declare
  table_name text;
  target_table regclass;
begin
  foreach table_name in array array[
    'inbound_unload',
    'warehouse_returns',
    'qc_items',
    'inbound_sample_model_breakdowns'
  ]
  loop
    target_table := to_regclass('public.' || table_name);

    if target_table is null then
      continue;
    end if;

    execute format(
      'drop trigger if exists warehouse_ms_inbound_realtime_broadcast on %s',
      target_table
    );
    execute format(
      'create trigger warehouse_ms_inbound_realtime_broadcast after insert or update or delete on %s for each row execute function public.broadcast_warehouse_ms_inbound_change()',
      target_table
    );
  end loop;
end;
$$;
