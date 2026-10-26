-- QC rejects without a PO can be sent in Arkline return batches and received back.
alter table public.arkline_qc_return_batches
  alter column po_id drop not null,
  alter column arkline_po_item_id drop not null;

alter table public.arkline_qc_return_batches
  add constraint arkline_qc_return_batches_po_pair_check
  check ((po_id is null) = (arkline_po_item_id is null));

alter table public.arkline_po_item_receipts
  alter column po_id drop not null,
  alter column arkline_po_item_id drop not null;

alter table public.arkline_po_item_receipts
  add constraint arkline_po_item_receipts_po_source_check
  check (
    (po_id is null) = (arkline_po_item_id is null)
    and (receipt_type <> 'INITIAL' or po_id is not null)
  );
