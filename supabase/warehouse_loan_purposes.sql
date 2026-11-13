create table if not exists public.warehouse_loan_purposes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists warehouse_loan_purposes_name_key
  on public.warehouse_loan_purposes (lower(btrim(name)));

insert into public.warehouse_loan_purposes (name)
values ('Photoshoot'), ('Content'), ('Sample')
on conflict do nothing;

alter table public.warehouse_loans
  add column if not exists purpose_id uuid references public.warehouse_loan_purposes(id) on delete restrict;

update public.warehouse_loans loan
set purpose_id = purpose.id
from public.warehouse_loan_purposes purpose
where loan.purpose_id is null and lower(btrim(loan.purpose)) = lower(btrim(purpose.name));

create index if not exists warehouse_loans_purpose_idx on public.warehouse_loans (purpose_id);

alter table public.warehouse_loan_purposes enable row level security;
revoke all on public.warehouse_loan_purposes from anon, authenticated;
grant select, insert on public.warehouse_loan_purposes to authenticated;

drop policy if exists warehouse_loan_purposes_read on public.warehouse_loan_purposes;
create policy warehouse_loan_purposes_read on public.warehouse_loan_purposes
  for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists warehouse_loan_purposes_add on public.warehouse_loan_purposes;
create policy warehouse_loan_purposes_add on public.warehouse_loan_purposes
  for insert to authenticated with check ((select auth.uid()) is not null);

create or replace function public.create_warehouse_loan(p_group text, p_purpose text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_item jsonb; v_purpose_id uuid; v_group text := upper(btrim(p_group)); v_email text := coalesce(auth.jwt()->>'email', '');
begin
  if (select auth.uid()) is null then raise exception 'Sign in to request a loan'; end if;
  if v_group not in ('ARKLINE','MOB','OI') or btrim(coalesce(p_purpose,'')) = '' then
    raise exception 'Choose a group and purpose';
  end if;
  insert into public.warehouse_loan_purposes (name)
  values (btrim(p_purpose)) on conflict do nothing;
  select id into v_purpose_id from public.warehouse_loan_purposes
  where lower(btrim(name)) = lower(btrim(p_purpose)) and is_active;
  if v_purpose_id is null then raise exception 'Choose an active loan purpose'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Add 1 to 50 products';
  end if;
  insert into public.warehouse_loans(group_code,purpose,purpose_id,requester_id,requester_email)
  values(v_group,btrim(p_purpose),v_purpose_id,(select auth.uid()),v_email) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if btrim(coalesce(v_item->>'sku','')) = '' or btrim(coalesce(v_item->>'name','')) = ''
      or coalesce((v_item->>'qty')::integer,0) <= 0 then
      raise exception 'Each product needs SKU, name, and positive qty';
    end if;
    if v_group = 'ARKLINE' and not exists (
      select 1 from public.arkline_dir_products p where p.is_active
        and upper(btrim(p.sku_induk)) = upper(btrim(v_item->>'sku'))
    ) then raise exception 'Arkline SKU not found: %', v_item->>'sku'; end if;
    insert into public.warehouse_loan_items(loan_id,event_type,sku_id,item_name,size,qty,actor_id,actor_email)
    values(v_id,'REQUEST',upper(btrim(v_item->>'sku')),btrim(v_item->>'name'),nullif(btrim(v_item->>'size'),''),
      (v_item->>'qty')::integer,(select auth.uid()),v_email);
  end loop;
  return v_id;
end;
$$;

