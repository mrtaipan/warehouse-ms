begin;

alter table public.pl_receiving
  drop constraint if exists packing_list_receiving_rows_received_qty_check;

alter table public.pl_receiving
  drop constraint if exists "packing_list_receiving_rows received_qty_check";

alter table public.pl_receiving
  drop constraint if exists pl_receiving_received_qty_check;

alter table public.pl_receiving
  add constraint pl_receiving_received_qty_check
  check (received_qty >= 0);

comment on constraint pl_receiving_received_qty_check on public.pl_receiving is
  'Packing List receiving can be 0 when QC Confirm has items that were not received by Packing List; negative quantities are not allowed.';

commit;
