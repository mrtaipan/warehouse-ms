alter table public.warehouse_returns
  add column if not exists pl_detail_seq integer null;

alter table public.warehouse_returns
  drop constraint if exists warehouse_returns_pl_detail_seq_check;

alter table public.warehouse_returns
  add constraint warehouse_returns_pl_detail_seq_check
  check (pl_detail_seq is null or pl_detail_seq > 0);

create index if not exists warehouse_returns_pl_detail_seq_idx
  on public.warehouse_returns (
    source_phase,
    inbound_id,
    model_name,
    variant_name,
    pl_detail_seq
  );

comment on column public.warehouse_returns.pl_detail_seq is
  'Packing List detail sequence that owns this return row. Null is retained only for legacy returns.';
