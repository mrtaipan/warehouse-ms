-- Run after the updated restock_request_owner_edit.sql, upload_sales_import_group_modes.sql,
-- and upload_sales_import_arkline_workflow.sql.
-- 14:00 UTC = 21:00 Asia/Jakarta (WIB). Run this once in the Supabase SQL Editor.
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if current_setting('cron.timezone', true) not in ('GMT', 'UTC') then
    raise exception 'Expected pg_cron timezone GMT/UTC; check cron.timezone before scheduling the 21:00 WIB job';
  end if;
end;
$$;

select cron.schedule(
  'arkline-sales-settlement-2100-wib',
  '0 14 * * *',
  $job$select public.settle_pending_arkline_sales_import_batches();$job$
);

select cron.schedule(
  'mob-sales-settlement-2100-wib',
  '0 14 * * *',
  $job$select public.settle_pending_mob_sales_import_batches();$job$
);
