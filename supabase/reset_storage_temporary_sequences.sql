-- Clear Temporary Sales and Storage Movement data,
-- then restart both identity sequences from 1.

truncate table
  public.warehouse_storage_movements,
  public.warehouse_temporary_sales_items
restart identity;

select
  'warehouse_temporary_sales_items' as table_name,
  coalesce(max(id), 0) as max_id,
  coalesce(pg_get_serial_sequence('public.warehouse_temporary_sales_items', 'id'), '-') as sequence_name
from public.warehouse_temporary_sales_items;

select
  'warehouse_storage_movements' as table_name,
  coalesce(max(id), 0) as max_id,
  coalesce(pg_get_serial_sequence('public.warehouse_storage_movements', 'id'), '-') as sequence_name
from public.warehouse_storage_movements;
