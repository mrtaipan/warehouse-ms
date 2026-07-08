alter table public.qc_confirm
  add column if not exists adjustment_type text null;

alter table public.warehouse_returns
  add column if not exists adjustment_type text null;

alter table public.qc_confirm
  drop constraint if exists qc_confirm_adjustment_type_check;

alter table public.qc_confirm
  add constraint qc_confirm_adjustment_type_check
  check (
    adjustment_type is null
    or adjustment_type in ('NORMAL', 'SURPLUS', 'SHORTAGE', 'REJECTION_MANUAL', 'TRANSFER')
  );

alter table public.warehouse_returns
  drop constraint if exists warehouse_returns_adjustment_type_check;

alter table public.warehouse_returns
  add constraint warehouse_returns_adjustment_type_check
  check (
    adjustment_type is null
    or adjustment_type in ('NORMAL', 'SURPLUS', 'SHORTAGE', 'REJECTION_MANUAL', 'TRANSFER')
  );
