-- Keep inbound_unload temporary sample status in sync with sample breakdown rows.
-- Run this once after inbound_sample_breakdowns.sql.

begin;

alter table public.inbound_unload
  add column if not exists is_product_temporary boolean not null default false,
  add column if not exists sample_resolved_at timestamp with time zone null,
  add column if not exists sample_resolved_by text null;

create or replace function public.update_inbound_sample_resolution_status(
  p_inbound_unload_id bigint,
  p_resolved_by text default null
)
returns void
language plpgsql
as $$
declare
  source_row record;
  breakdown_total bigint;
  breakdown_actor text;
begin
  if p_inbound_unload_id is null then
    return;
  end if;

  select id, qty, is_sample, sample_resolved_at, sample_resolved_by
  into source_row
  from public.inbound_unload
  where id = p_inbound_unload_id;

  if not found or coalesce(source_row.is_sample, false) is not true then
    return;
  end if;

  select
    coalesce(sum(qty), 0),
    (
      array_agg(
        coalesce(nullif(updated_by, ''), nullif(created_by, ''))
        order by updated_at desc, created_at desc, id desc
      ) filter (where coalesce(nullif(updated_by, ''), nullif(created_by, '')) is not null)
    )[1]
  into breakdown_total, breakdown_actor
  from public.inbound_sample_model_breakdowns
  where inbound_unload_id = p_inbound_unload_id;

  if coalesce(source_row.qty, 0) > 0 and breakdown_total >= coalesce(source_row.qty, 0) then
    update public.inbound_unload
    set
      is_product_temporary = false,
      sample_resolved_at = coalesce(source_row.sample_resolved_at, now()),
      sample_resolved_by = coalesce(nullif(p_resolved_by, ''), breakdown_actor, source_row.sample_resolved_by),
      updated_at = now()
    where id = p_inbound_unload_id;
  else
    update public.inbound_unload
    set
      is_product_temporary = true,
      sample_resolved_at = null,
      sample_resolved_by = null,
      updated_at = now()
    where id = p_inbound_unload_id;
  end if;
end $$;

create or replace function public.trg_update_inbound_sample_resolution_status()
returns trigger
language plpgsql
as $$
declare
  next_actor text;
begin
  if tg_op = 'DELETE' then
    perform public.update_inbound_sample_resolution_status(
      old.inbound_unload_id,
      coalesce(nullif(old.updated_by, ''), nullif(old.created_by, ''))
    );
    return old;
  end if;

  next_actor := coalesce(nullif(new.updated_by, ''), nullif(new.created_by, ''));

  if tg_op = 'UPDATE' and old.inbound_unload_id is distinct from new.inbound_unload_id then
    perform public.update_inbound_sample_resolution_status(
      old.inbound_unload_id,
      coalesce(nullif(old.updated_by, ''), nullif(old.created_by, ''))
    );
  end if;

  perform public.update_inbound_sample_resolution_status(new.inbound_unload_id, next_actor);
  return new;
end $$;

drop trigger if exists trg_update_inbound_sample_resolution_status
  on public.inbound_sample_model_breakdowns;

create trigger trg_update_inbound_sample_resolution_status
after insert or update or delete on public.inbound_sample_model_breakdowns
for each row
execute function public.trg_update_inbound_sample_resolution_status();

do $$
declare
  source_id bigint;
begin
  for source_id in
    select distinct inbound_unload_id
    from public.inbound_sample_model_breakdowns
    where inbound_unload_id is not null
  loop
    perform public.update_inbound_sample_resolution_status(source_id);
  end loop;
end $$;

commit;
