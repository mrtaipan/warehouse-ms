-- Loan cases and their item-level audit trail. Apply before opening the Loan tab.
begin;
create table if not exists public.warehouse_loans (
  id uuid primary key default gen_random_uuid(),
  group_code text not null check (group_code in ('ARKLINE', 'MOB', 'OI')),
  purpose text not null check (length(btrim(purpose)) > 0),
  requester_id uuid not null,
  requester_email text not null,
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED', 'IN_LOAN', 'RETURN_PENDING', 'COMPLETED', 'CLOSED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_loan_items (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.warehouse_loans(id) on delete restrict,
  request_item_id uuid null references public.warehouse_loan_items(id) on delete restrict,
  declaration_id uuid null references public.warehouse_loan_items(id) on delete restrict,
  queue_return_id uuid null references public.warehouse_loan_items(id) on delete restrict,
  event_type text not null check (event_type in ('REQUEST', 'ISSUE', 'DECLARE_RETURN', 'RECEIVE', 'CLOSE', 'QUEUE_STORED', 'CANCEL_REQUEST')),
  sku_id text,
  item_name text,
  size text,
  category_id bigint references public.dir_categories(id) on delete set null,
  brand_code text,
  qty integer not null check (qty > 0),
  source_type text check (source_type in ('STORAGE', 'PL_QUEUE')),
  source_warehouse_storage_id bigint references public.warehouse_storage(id) on delete set null,
  source_pl_packing_item_id bigint references public.pl_packing_items(id) on delete restrict,
  source_label text,
  destination_type text check (destination_type in ('STORAGE', 'SHELVING_QUEUE', 'STORAGE_QUEUE', 'TEMP_SALES', 'RE_QC')),
  destination_rack_location_id bigint references public.dir_rack_locations(id) on delete set null,
  disposition text check (disposition in ('LOST', 'DAMAGED', 'PURCHASED', 'OTHER')),
  notes text,
  actor_id uuid not null,
  actor_email text not null,
  created_at timestamptz not null default now(),
  constraint loan_event_shape check (
    (event_type = 'REQUEST' and request_item_id is null and declaration_id is null)
    or (event_type <> 'REQUEST' and request_item_id is not null)
  )
);

create index if not exists warehouse_loans_requester_idx on public.warehouse_loans (requester_id, created_at desc);
create index if not exists warehouse_loans_status_idx on public.warehouse_loans (status, created_at desc);
create index if not exists warehouse_loan_items_case_idx on public.warehouse_loan_items (loan_id, created_at);
create index if not exists warehouse_loan_items_request_idx on public.warehouse_loan_items (request_item_id, event_type);
create index if not exists warehouse_loan_items_pl_issue_idx on public.warehouse_loan_items (source_pl_packing_item_id)
  where event_type = 'ISSUE' and source_pl_packing_item_id is not null;
create index if not exists warehouse_loan_items_queue_return_idx on public.warehouse_loan_items (created_at)
  where event_type = 'RECEIVE' and destination_type = 'STORAGE_QUEUE';

create or replace function public.warehouse_loan_pl_issued_quantities()
returns table(pl_packing_item_id bigint, issued_qty bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not (
    public.reqc_has_permission('storage.location.view')
    or public.reqc_has_permission('storage.queue.view')
    or public.reqc_has_permission('storage.shelving_upload.view')
    or public.reqc_has_permission('storage.pick_history.view')
    or public.reqc_has_permission('storage.product_directory.view')
  ) then raise exception 'Not allowed to read Storage Queue availability'; end if;
  return query select source_pl_packing_item_id, sum(qty)::bigint
    from public.warehouse_loan_items
    where event_type='ISSUE' and source_pl_packing_item_id is not null
    group by source_pl_packing_item_id;
end;
$$;
revoke all on function public.warehouse_loan_pl_issued_quantities() from public,anon;
grant execute on function public.warehouse_loan_pl_issued_quantities() to authenticated;

alter table public.warehouse_loans enable row level security;
alter table public.warehouse_loan_items enable row level security;
grant select on public.warehouse_loans, public.warehouse_loan_items to authenticated;

create or replace function public.warehouse_loan_can_manage()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.reqc_has_permission('storage.location.edit')
    or public.reqc_has_permission('storage.queue.edit');
$$;
revoke all on function public.warehouse_loan_can_manage() from public, anon;
grant execute on function public.warehouse_loan_can_manage() to authenticated;

drop policy if exists warehouse_loans_read on public.warehouse_loans;
create policy warehouse_loans_read on public.warehouse_loans for select to authenticated
  using (requester_id = (select auth.uid()) or public.warehouse_loan_can_manage());
drop policy if exists warehouse_loan_items_read on public.warehouse_loan_items;
create policy warehouse_loan_items_read on public.warehouse_loan_items for select to authenticated
  using (exists (
    select 1 from public.warehouse_loans loan
    where loan.id = loan_id and (loan.requester_id = (select auth.uid()) or public.warehouse_loan_can_manage())
  ));

create or replace function public.warehouse_loan_refresh_status(p_loan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_issued integer; v_requested integer; v_resolved integer; v_declared integer; v_closed integer; v_cancelled integer;
begin
  select
    coalesce(sum(qty) filter (where event_type = 'REQUEST'), 0),
    coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type in ('RECEIVE', 'CLOSE')), 0),
    coalesce(sum(qty) filter (where event_type = 'DECLARE_RETURN'), 0),
    coalesce(sum(qty) filter (where event_type = 'CLOSE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CANCEL_REQUEST'), 0)
  into v_requested, v_issued, v_resolved, v_declared, v_closed, v_cancelled
  from public.warehouse_loan_items where loan_id = p_loan_id;
  update public.warehouse_loans set status = case
    when v_cancelled = v_requested and v_issued = 0 then 'CANCELLED'
    when v_issued + v_cancelled >= v_requested and v_resolved >= v_issued and v_closed > 0 then 'CLOSED'
    when v_issued + v_cancelled >= v_requested and v_resolved >= v_issued then 'COMPLETED'
    when v_declared > (select coalesce(sum(qty), 0) from public.warehouse_loan_items
      where loan_id = p_loan_id and event_type = 'RECEIVE') then 'RETURN_PENDING'
    when v_issued > 0 then 'IN_LOAN'
    else 'REQUESTED' end,
    updated_at = now()
  where id = p_loan_id;
end;
$$;
revoke all on function public.warehouse_loan_refresh_status(uuid) from public, anon, authenticated;

create or replace function public.create_warehouse_loan(p_group text, p_purpose text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_item jsonb; v_group text := upper(btrim(p_group)); v_email text := coalesce(auth.jwt()->>'email', '');
begin
  if (select auth.uid()) is null then raise exception 'Sign in to request a loan'; end if;
  if v_group not in ('ARKLINE','MOB','OI') or btrim(coalesce(p_purpose,'')) = '' then
    raise exception 'Choose a group and purpose';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Add 1 to 50 products';
  end if;
  insert into public.warehouse_loans(group_code,purpose,requester_id,requester_email)
  values(v_group,btrim(p_purpose),(select auth.uid()),v_email) returning id into v_id;
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
revoke all on function public.create_warehouse_loan(text,text,jsonb) from public, anon;
grant execute on function public.create_warehouse_loan(text,text,jsonb) to authenticated;

create or replace function public.issue_warehouse_loan_item(p_item_id uuid,p_source_type text,p_source_id bigint,p_qty integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.warehouse_loan_items%rowtype; v_loan public.warehouse_loans%rowtype;
  v_stock public.warehouse_storage%rowtype; v_pl public.pl_packing_items%rowtype;
  v_location public.dir_rack_locations%rowtype; v_issued integer; v_available integer;
  v_id uuid; v_email text := coalesce(auth.jwt()->>'email',''); v_source_label text;
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then raise exception 'Not allowed to issue loans'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty must be positive'; end if;
  select * into v_request from public.warehouse_loan_items where id=p_item_id and event_type='REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id=v_request.loan_id for update;
  select coalesce(sum(qty) filter (where event_type='ISSUE'),0),
    coalesce(sum(qty) filter (where event_type='CANCEL_REQUEST'),0)
  into v_issued,v_available from public.warehouse_loan_items where request_item_id=p_item_id;
  if v_issued+v_available+p_qty>v_request.qty then raise exception 'Qty exceeds requested amount'; end if;
  if p_source_type='STORAGE' then
    select * into v_stock from public.warehouse_storage where id=p_source_id for update;
    if not found or coalesce(v_stock.qty,0)<p_qty then raise exception 'Insufficient storage stock'; end if;
    select * into v_location from public.dir_rack_locations where id=v_stock.rack_location_id;
    if upper(coalesce(v_location.group_code,''))<>v_loan.group_code then raise exception 'Source group differs from loan'; end if;
    v_source_label := concat_ws(' / ',v_location.location_type,v_location.location_id,
      v_location.location_code,nullif(v_location.sub_location,''));
    if not public.warehouse_sizes_match(v_stock.size,v_request.size) or
      not (public.upload_stock_sku_tokens(v_stock.sku_id,v_stock.source_variant_code,v_stock.item_name)
        @> array[upper(regexp_replace(v_request.sku_id,'[^A-Z0-9]','','g'))]) then
      raise exception 'Source product or size differs from request';
    end if;
    update public.warehouse_storage set qty=qty-p_qty,updated_at=now(),updated_by=v_email where id=v_stock.id;
  elsif p_source_type='PL_QUEUE' then
    select * into v_pl from public.pl_packing_items where id=p_source_id for update;
    if not found or v_pl.storage_status<>'queued' or upper(v_pl.storing_type)<>v_loan.group_code then
      raise exception 'Packing List item is not available in Storage Queue';
    end if;
    if not public.warehouse_sizes_match(v_pl.size_label,v_request.size) or
      upper(regexp_replace(coalesce(v_pl.source_variant_code,''),'[^A-Z0-9]','','g'))<>
      upper(regexp_replace(v_request.sku_id,'[^A-Z0-9]','','g')) then
      raise exception 'Queue product or size differs from request';
    end if;
    select v_pl.qty-coalesce(sum(qty),0) into v_available from public.warehouse_loan_items
    where source_pl_packing_item_id=v_pl.id and event_type='ISSUE';
    if v_available<p_qty then raise exception 'Insufficient Storage Queue qty'; end if;
  else raise exception 'Choose a stock or Storage Queue source'; end if;
  insert into public.warehouse_loan_items(loan_id,request_item_id,event_type,sku_id,item_name,size,category_id,brand_code,qty,
    source_type,source_warehouse_storage_id,source_pl_packing_item_id,source_label,actor_id,actor_email)
  values(v_loan.id,p_item_id,'ISSUE',v_request.sku_id,v_request.item_name,v_request.size,
    case when p_source_type='STORAGE' then v_stock.category_id end,
    case when p_source_type='STORAGE' then v_stock.brand_code end,p_qty,p_source_type,
    case when p_source_type='STORAGE' then p_source_id end,
    case when p_source_type='PL_QUEUE' then p_source_id end,
    case when p_source_type='STORAGE' then v_source_label
      else 'Storage Queue / PL '||p_source_id::text end,(select auth.uid()),v_email)
  returning id into v_id;
  if p_source_type='STORAGE' then
    insert into public.warehouse_storage_movements(warehouse_storage_id,movement_type,qty,
      from_location_label,to_location_label,item_name,size,sku_id,created_by)
    values(v_stock.id,'LOAN_OUT',p_qty,v_source_label,'Peminjaman '||v_loan.id::text,
      v_request.item_name,v_request.size,v_request.sku_id,v_email);
    if v_stock.qty = p_qty and not (v_location.group_code='ARKLINE' and v_location.location_type='SHELVING') then
      delete from public.warehouse_storage where id=v_stock.id;
    end if;
  end if;
  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;
revoke all on function public.issue_warehouse_loan_item(uuid,text,bigint,integer) from public, anon;
grant execute on function public.issue_warehouse_loan_item(uuid,text,bigint,integer) to authenticated;

create or replace function public.cancel_warehouse_loan_request_item(p_item_id uuid, p_qty integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.warehouse_loan_items%rowtype; v_loan public.warehouse_loans%rowtype;
  v_issued integer; v_cancelled integer; v_id uuid;
begin
  if (select auth.uid()) is null or p_qty is null or p_qty <= 0 then raise exception 'Enter a positive qty'; end if;
  select * into v_request from public.warehouse_loan_items where id=p_item_id and event_type='REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id=v_request.loan_id for update;
  if v_loan.requester_id<>(select auth.uid()) and not public.warehouse_loan_can_manage() then
    raise exception 'Not allowed to cancel this request';
  end if;
  select coalesce(sum(qty) filter (where event_type='ISSUE'),0),
    coalesce(sum(qty) filter (where event_type='CANCEL_REQUEST'),0)
  into v_issued,v_cancelled from public.warehouse_loan_items where request_item_id=p_item_id;
  if v_issued+v_cancelled+p_qty>v_request.qty then raise exception 'Qty exceeds unissued request'; end if;
  insert into public.warehouse_loan_items(loan_id,request_item_id,event_type,sku_id,item_name,size,qty,actor_id,actor_email)
  values(v_loan.id,p_item_id,'CANCEL_REQUEST',v_request.sku_id,v_request.item_name,v_request.size,p_qty,
    (select auth.uid()),coalesce(auth.jwt()->>'email','')) returning id into v_id;
  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;
revoke all on function public.cancel_warehouse_loan_request_item(uuid,integer) from public, anon;
grant execute on function public.cancel_warehouse_loan_request_item(uuid,integer) to authenticated;

create or replace function public.declare_warehouse_loan_return(p_item_id uuid,p_qty integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.warehouse_loan_items%rowtype; v_loan public.warehouse_loans%rowtype;
  v_issued integer; v_received integer; v_closed integer; v_declared integer; v_id uuid;
begin
  if (select auth.uid()) is null or p_qty is null or p_qty<=0 then raise exception 'Enter a positive return qty'; end if;
  select * into v_request from public.warehouse_loan_items where id=p_item_id and event_type='REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id=v_request.loan_id for update;
  if v_loan.requester_id<>(select auth.uid()) then raise exception 'Only the borrower can declare a return'; end if;
  select coalesce(sum(qty) filter (where event_type='ISSUE'),0),
    coalesce(sum(qty) filter (where event_type='RECEIVE'),0),
    coalesce(sum(qty) filter (where event_type='CLOSE'),0),
    coalesce(sum(qty) filter (where event_type='DECLARE_RETURN'),0)
  into v_issued,v_received,v_closed,v_declared
  from public.warehouse_loan_items where request_item_id=p_item_id;
  if p_qty>v_issued-v_closed-v_declared then raise exception 'Return qty exceeds borrowed balance'; end if;
  insert into public.warehouse_loan_items(loan_id,request_item_id,event_type,sku_id,item_name,size,qty,actor_id,actor_email)
  values(v_loan.id,p_item_id,'DECLARE_RETURN',v_request.sku_id,v_request.item_name,v_request.size,p_qty,
    (select auth.uid()),coalesce(auth.jwt()->>'email','')) returning id into v_id;
  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;
revoke all on function public.declare_warehouse_loan_return(uuid,integer) from public, anon;
grant execute on function public.declare_warehouse_loan_return(uuid,integer) to authenticated;

create or replace function public.receive_warehouse_loan_return(
  p_declaration_id uuid,p_qty integer,p_destination text,p_rack_location_id bigint default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_declaration public.warehouse_loan_items%rowtype; v_request public.warehouse_loan_items%rowtype;
  v_loan public.warehouse_loans%rowtype; v_location public.dir_rack_locations%rowtype;
  v_received integer; v_id uuid; v_reqc_queue_id uuid; v_new_storage_id bigint;
  v_email text := coalesce(auth.jwt()->>'email','');
  v_category_id bigint; v_brand_code text; v_pl_source_id bigint;
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then raise exception 'Not allowed to receive loans'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Qty must be positive'; end if;
  select * into v_declaration from public.warehouse_loan_items
  where id=p_declaration_id and event_type='DECLARE_RETURN' for update;
  if not found then raise exception 'Return declaration not found'; end if;
  select * into v_request from public.warehouse_loan_items where id=v_declaration.request_item_id;
  select * into v_loan from public.warehouse_loans where id=v_declaration.loan_id for update;
  select coalesce(sum(qty),0) into v_received from public.warehouse_loan_items
  where declaration_id=p_declaration_id and event_type='RECEIVE';
  if v_received+p_qty>v_declaration.qty then raise exception 'Qty exceeds declared return'; end if;
  if p_destination not in ('STORAGE','SHELVING_QUEUE','STORAGE_QUEUE','TEMP_SALES','RE_QC') then
    raise exception 'Choose a return destination';
  end if;
  if p_destination='STORAGE_QUEUE' and (
    not exists (select 1 from public.warehouse_loan_items where request_item_id=v_request.id
      and event_type='ISSUE' and source_type='PL_QUEUE')
    or exists (select 1 from public.warehouse_loan_items where request_item_id=v_request.id
      and event_type='ISSUE' and source_type<>'PL_QUEUE')
  ) then raise exception 'Storage Queue return requires this item to be borrowed only from Storage Queue'; end if;
  select category_id,brand_code into v_category_id,v_brand_code
  from public.warehouse_loan_items where request_item_id=v_request.id and event_type='ISSUE'
    and category_id is not null order by created_at desc limit 1;
  if not exists (select 1 from public.warehouse_loan_items where request_item_id=v_request.id
      and event_type='ISSUE' and source_type='STORAGE') then
    select source_pl_packing_item_id into v_pl_source_id
    from public.warehouse_loan_items where request_item_id=v_request.id and event_type='ISSUE'
    order by created_at desc limit 1;
  end if;
  if p_destination='STORAGE' then
    select * into v_location from public.dir_rack_locations where id=p_rack_location_id;
    if not found or upper(coalesce(v_location.group_code,''))<>v_loan.group_code
      or upper(coalesce(v_location.location_type,'')) not in ('PALLET','SHELVING') then
      raise exception 'Choose a pallet or shelving location in the same group';
    end if;
    insert into public.warehouse_storage(rack_location_id,source_pl_packing_item_id,sku_id,source_variant_code,item_name,size,category_id,brand_code,qty,notes,updated_by)
    values(v_location.id,v_pl_source_id,v_request.sku_id,v_request.sku_id,v_request.item_name,v_request.size,v_category_id,v_brand_code,p_qty,
      'Returned from loan '||v_loan.id::text,v_email) returning id into v_new_storage_id;
    insert into public.warehouse_storage_movements(warehouse_storage_id,movement_type,qty,
      from_location_label,to_location_label,item_name,size,sku_id,created_by)
    values(v_new_storage_id,'LOAN_RETURN',p_qty,'Peminjaman '||v_loan.id::text,
      concat_ws(' / ',v_location.location_type,v_location.location_id,v_location.location_code,nullif(v_location.sub_location,'')),
      v_request.item_name,v_request.size,v_request.sku_id,v_email);
  elsif p_destination='TEMP_SALES' then
    insert into public.warehouse_temporary_sales_items(source_pl_packing_item_id,sku_id,source_variant_code,item_name,size,category_id,group_code,
      area_type,source_location_label,qty_in_area,status,created_by)
    values(v_pl_source_id,v_request.sku_id,v_request.sku_id,v_request.item_name,v_request.size,v_category_id,v_loan.group_code,
      'SALES','Returned from loan '||v_loan.id::text,p_qty,'IN_TEMPORARY_AREA',v_email);
  elsif p_destination='SHELVING_QUEUE' then
    insert into public.warehouse_shelving_queue(sku_id,source_variant_code,item_name,size,group_code,qty,
      status,notes,created_by)
    values(v_request.sku_id,v_request.sku_id,v_request.item_name,v_request.size,v_loan.group_code,p_qty,
      'WAITING_SHELVING','Returned from loan '||v_loan.id::text,v_email);
  elsif p_destination='RE_QC' then
    insert into public.reqc_queue(sku_id,source_variant_code,item_name,size,category_id,brand_code,group_code,qty,status,notes,created_by)
    values(v_request.sku_id,v_request.sku_id,v_request.item_name,v_request.size,v_category_id,v_brand_code,v_loan.group_code,p_qty,
      'WAITING_QC','Returned from loan '||v_loan.id::text,v_email) returning id into v_reqc_queue_id;
  end if;
  insert into public.warehouse_loan_items(loan_id,request_item_id,declaration_id,event_type,sku_id,item_name,size,
    category_id,brand_code,source_pl_packing_item_id,qty,
    destination_type,destination_rack_location_id,actor_id,actor_email)
  values(v_loan.id,v_request.id,v_declaration.id,'RECEIVE',v_request.sku_id,v_request.item_name,v_request.size,
    v_category_id,v_brand_code,v_pl_source_id,p_qty,
    p_destination,p_rack_location_id,(select auth.uid()),v_email) returning id into v_id;
  if v_reqc_queue_id is not null then
    update public.reqc_queue set source_loan_receive_id=v_id where id=v_reqc_queue_id;
  end if;
  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;
revoke all on function public.receive_warehouse_loan_return(uuid,integer,text,bigint) from public, anon;
grant execute on function public.receive_warehouse_loan_return(uuid,integer,text,bigint) to authenticated;

create or replace function public.close_warehouse_loan_item(p_item_id uuid,p_qty integer,p_disposition text,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.warehouse_loan_items%rowtype; v_loan public.warehouse_loans%rowtype;
  v_issued integer; v_received integer; v_closed integer; v_declared integer; v_id uuid;
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then raise exception 'Not allowed to close loans'; end if;
  if p_qty is null or p_qty<=0 or p_disposition not in ('LOST','DAMAGED','PURCHASED','OTHER')
    or btrim(coalesce(p_reason,''))='' then raise exception 'Enter qty, outcome, and reason'; end if;
  select * into v_request from public.warehouse_loan_items where id=p_item_id and event_type='REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id=v_request.loan_id for update;
  select coalesce(sum(qty) filter (where event_type='ISSUE'),0),
    coalesce(sum(qty) filter (where event_type='RECEIVE'),0),
    coalesce(sum(qty) filter (where event_type='CLOSE'),0),
    coalesce(sum(qty) filter (where event_type='DECLARE_RETURN'),0)
  into v_issued,v_received,v_closed,v_declared
  from public.warehouse_loan_items where request_item_id=p_item_id;
  if p_qty>v_issued-v_received-v_closed-(v_declared-v_received) then
    raise exception 'Resolve pending returns before closing the remaining qty';
  end if;
  insert into public.warehouse_loan_items(loan_id,request_item_id,event_type,sku_id,item_name,size,qty,
    disposition,notes,actor_id,actor_email)
  values(v_loan.id,p_item_id,'CLOSE',v_request.sku_id,v_request.item_name,v_request.size,p_qty,
    p_disposition,btrim(p_reason),(select auth.uid()),coalesce(auth.jwt()->>'email','')) returning id into v_id;
  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;
revoke all on function public.close_warehouse_loan_item(uuid,integer,text,text) from public, anon;
grant execute on function public.close_warehouse_loan_item(uuid,integer,text,text) to authenticated;

create or replace function public.place_warehouse_loan_queue_return(
  p_receive_id uuid,p_qty integer,p_destination text,p_rack_location_id bigint default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_return public.warehouse_loan_items%rowtype; v_loan public.warehouse_loans%rowtype;
  v_location public.dir_rack_locations%rowtype; v_placed integer; v_id uuid; v_new_storage_id bigint;
  v_email text := coalesce(auth.jwt()->>'email','');
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then raise exception 'Not allowed to store queue returns'; end if;
  if p_qty is null or p_qty<=0 or p_destination not in ('STORAGE','TEMP_SALES') then
    raise exception 'Choose a destination and positive qty';
  end if;
  select * into v_return from public.warehouse_loan_items
  where id=p_receive_id and event_type='RECEIVE' and destination_type='STORAGE_QUEUE' for update;
  if not found then raise exception 'Loan Storage Queue entry not found'; end if;
  select * into v_loan from public.warehouse_loans where id=v_return.loan_id for update;
  select coalesce(sum(qty),0) into v_placed from public.warehouse_loan_items
  where queue_return_id=p_receive_id and event_type='QUEUE_STORED';
  if v_placed+p_qty>v_return.qty then raise exception 'Qty exceeds available queue return'; end if;
  if p_destination='STORAGE' then
    select * into v_location from public.dir_rack_locations where id=p_rack_location_id;
    if not found or upper(coalesce(v_location.group_code,''))<>v_loan.group_code
      or upper(coalesce(v_location.location_type,'')) not in ('PALLET','SHELVING') then
      raise exception 'Choose a pallet or shelving location in the same group';
    end if;
    insert into public.warehouse_storage(rack_location_id,source_pl_packing_item_id,sku_id,source_variant_code,item_name,size,category_id,brand_code,qty,notes,updated_by)
    values(v_location.id,v_return.source_pl_packing_item_id,v_return.sku_id,v_return.sku_id,v_return.item_name,v_return.size,
      v_return.category_id,v_return.brand_code,p_qty,
      'Stored from loan return queue '||v_loan.id::text,v_email) returning id into v_new_storage_id;
    insert into public.warehouse_storage_movements(warehouse_storage_id,movement_type,qty,
      from_location_label,to_location_label,item_name,size,sku_id,created_by)
    values(v_new_storage_id,'LOAN_RETURN',p_qty,'Peminjaman / Storage Queue',
      concat_ws(' / ',v_location.location_type,v_location.location_id,v_location.location_code,nullif(v_location.sub_location,'')),
      v_return.item_name,v_return.size,v_return.sku_id,v_email);
  else
    insert into public.warehouse_temporary_sales_items(source_pl_packing_item_id,sku_id,source_variant_code,item_name,size,category_id,group_code,
      area_type,source_location_label,qty_in_area,status,created_by)
    values(v_return.source_pl_packing_item_id,v_return.sku_id,v_return.sku_id,v_return.item_name,v_return.size,
      v_return.category_id,v_loan.group_code,
      'SALES','Loan return queue '||v_loan.id::text,p_qty,'IN_TEMPORARY_AREA',v_email);
  end if;
  insert into public.warehouse_loan_items(loan_id,request_item_id,queue_return_id,event_type,sku_id,item_name,size,qty,
    destination_type,destination_rack_location_id,actor_id,actor_email)
  values(v_loan.id,v_return.request_item_id,v_return.id,'QUEUE_STORED',v_return.sku_id,v_return.item_name,v_return.size,
    p_qty,p_destination,p_rack_location_id,(select auth.uid()),v_email) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.place_warehouse_loan_queue_return(uuid,integer,text,bigint) from public, anon;
grant execute on function public.place_warehouse_loan_queue_return(uuid,integer,text,bigint) to authenticated;

alter table public.reqc_queue
  add column if not exists source_loan_receive_id uuid references public.warehouse_loan_items(id) on delete restrict;
create unique index if not exists reqc_queue_loan_receive_uidx
  on public.reqc_queue(source_loan_receive_id) where source_loan_receive_id is not null;

-- Arkline loan Re-QC has no PO. Its grading tasks use reqc_queue/qc_items,
-- while B/C outcomes remain in Arkline Rejection Storage.
alter table public.arkline_qc_rejection_storage_batches
  drop constraint if exists arkline_qc_rejection_storage_batches_source_type_check;
alter table public.arkline_qc_rejection_storage_batches
  add constraint arkline_qc_rejection_storage_batches_source_type_check
    check (source_type in ('QC_REJECT','PACKING_REJECT','DELIVERY_REJECT','LOAN_RE_QC'));
alter table public.arkline_qc_rejection_storage_lines
  add column if not exists reqc_result_id uuid references public.reqc_results(id) on delete restrict;
create unique index if not exists arkline_loan_reqc_result_uidx
  on public.arkline_qc_rejection_storage_lines(reqc_result_id) where reqc_result_id is not null;

alter table public.warehouse_storage_movements
  drop constraint if exists warehouse_storage_movements_type_check;
alter table public.warehouse_storage_movements
  add constraint warehouse_storage_movements_type_check check (movement_type in (
    'STORE_QUEUE','MOVE','TAKE_OUT','TEMPORARY_IN','TEMPORARY_RETURN',
    'TEMPORARY_ADJUSTMENT_IN','TEMPORARY_ADJUSTMENT_OUT','PUTAWAY_IN',
    'CUSTOMER_RETURN_IN','CUSTOMER_REPLACEMENT_OUT','QC_RECHECK_OUT','REJECT_OUT',
    'LOAN_OUT','LOAN_RETURN'
  ));

create or replace function public.review_arkline_loan_reqc_results(
  p_result_ids uuid[], p_action text, p_reject_note text default null
)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_result public.reqc_results%rowtype; v_queue public.reqc_queue%rowtype;
  v_id uuid; v_batch_id uuid; v_count integer := 0; v_actor text := coalesce(auth.jwt()->>'email','');
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to review Re-QC';
  end if;
  if coalesce(cardinality(p_result_ids),0)=0 or
    (select count(distinct id) from unnest(p_result_ids) as selected(id))<>cardinality(p_result_ids) then
    raise exception 'Select unique Re-QC results';
  end if;
  if p_action not in ('CONFIRM_A','STORE_REJECT') then raise exception 'Choose a review action'; end if;
  if p_action='STORE_REJECT' and btrim(coalesce(p_reject_note,''))='' then
    raise exception 'Enter a reject note';
  end if;
  for v_id in select id from unnest(p_result_ids) as selected(id) order by id loop
    select * into v_result from public.reqc_results where id=v_id for update;
    select * into v_queue from public.reqc_queue where id=v_result.reqc_queue_id;
    if v_result.status<>'PENDING_REVIEW' or v_queue.group_code<>'ARKLINE'
      or v_queue.source_loan_receive_id is null then
      raise exception 'Result % is not an Arkline loan awaiting review', v_id;
    end if;
    if p_action='CONFIRM_A' then
      if v_result.grade<>'A' then raise exception 'Select only Grade A results'; end if;
      perform public.confirm_reqc_grade_a_to_storage(v_id,v_actor);
    else
      if v_result.grade not in ('B','C') then raise exception 'Select only Grade B/C results'; end if;
      insert into public.arkline_qc_rejection_storage_batches(
        storage_number,sku_induk,model_name_snapshot,round_number,storage_date,
        stored_qty,source_type,notes,created_by
      ) values (
        'LOAN-'||left(v_id::text,8),coalesce(v_queue.sku_id,v_queue.source_variant_code,'UNKNOWN'),
        v_queue.item_name,1,(now() at time zone 'Asia/Jakarta')::date,
        v_result.qty,'LOAN_RE_QC',btrim(p_reject_note),v_actor
      ) returning id into v_batch_id;
      insert into public.arkline_qc_rejection_storage_lines(
        storage_batch_id,reqc_result_id,reason_snapshot,grade,size,qty
      ) values (v_batch_id,v_id,btrim(p_reject_note),v_result.grade,coalesce(v_queue.size,'-'),v_result.qty);
      update public.reqc_results set status='REJECTION_STORAGE',reviewed_by=v_actor,
        reviewed_at=now(),updated_at=now() where id=v_id;
    end if;
    v_count := v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.review_arkline_loan_reqc_results(uuid[],text,text) from public,anon;
grant execute on function public.review_arkline_loan_reqc_results(uuid[],text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
