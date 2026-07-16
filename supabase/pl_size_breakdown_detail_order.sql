begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'display_order'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'detail_order'
  ) then
    alter table public.pl_size_breakdown rename column display_order to detail_order;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'display_order'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'detail_order'
  ) then
    update public.pl_size_breakdown
    set detail_order = coalesce(detail_order, display_order, 1)
    where detail_order is null;

    alter table public.pl_size_breakdown drop column display_order;
  end if;
end $$;

alter table public.pl_size_breakdown
  add column if not exists detail_order integer not null default 1;

update public.pl_size_breakdown
set detail_order = coalesce(detail_order, pl_detail_seq, 1)
where detail_order is null;

alter table public.pl_size_breakdown
  alter column detail_order set default 1,
  alter column detail_order set not null;

alter table public.pl_size_breakdown
  drop constraint if exists pl_size_breakdown_display_order_check,
  drop constraint if exists pl_size_breakdown_detail_order_check;

alter table public.pl_size_breakdown
  add constraint pl_size_breakdown_detail_order_check check (detail_order >= 1);

drop index if exists public.pl_size_breakdown_display_idx;
drop index if exists public.pl_size_breakdown_detail_idx;

create index pl_size_breakdown_detail_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, detail_order);

commit;
