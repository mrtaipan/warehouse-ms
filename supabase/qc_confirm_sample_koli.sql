alter table public.qc_confirm
  add column if not exists is_sample boolean not null default false;

create index if not exists qc_confirm_inbound_sample_sequence_idx
  on public.qc_confirm (inbound_id, is_sample, koli_sequence);
