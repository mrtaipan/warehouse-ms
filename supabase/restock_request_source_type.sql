begin;

alter table public.restock_request
  add column if not exists source_type text;

update public.restock_request
set source_type = 'MOB'
where source_type is null
   or trim(source_type) = '';

alter table public.restock_request
  alter column source_type set default 'MOB';

alter table public.restock_request
  alter column source_type set not null;

alter table public.restock_request
  drop constraint if exists restock_request_source_type_check;

alter table public.restock_request
  add constraint restock_request_source_type_check
  check (source_type in ('MOB', 'ARKLINE'));

create index if not exists restock_request_source_type_status_idx
  on public.restock_request (source_type, request_status, created_at desc);

commit;
