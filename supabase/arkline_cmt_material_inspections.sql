create table if not exists public.arkline_cmt_material_inspections (
  id uuid primary key default gen_random_uuid(),
  material_po_ordered_id uuid not null references public.arkline_po_material_ordered(id) on delete restrict,
  material_po_ordered_item_id uuid not null references public.arkline_po_material_ordered_items(id) on delete restrict,
  po_number text not null,
  supplier_name text not null,
  material_name text not null,
  lot text not null check (btrim(lot) <> ''),
  nominal_width_in numeric(12,2) not null check (nominal_width_in > 0),
  nominal_gsm numeric(12,2) not null check (nominal_gsm > 0),
  remarks text,
  total_points integer not null default 0 check (total_points >= 0),
  scored_points integer not null default 0 check (scored_points >= 0),
  total_area_sq_yd numeric(18,4) not null default 0 check (total_area_sq_yd >= 0),
  points_per_100_sq_yd integer not null default 0 check (points_per_100_sq_yd >= 0),
  grade text not null default 'A' check (grade in ('A', 'B', 'C', 'X')),
  inspected_by text not null,
  inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists arkline_cmt_material_inspections_item_date_idx
  on public.arkline_cmt_material_inspections (material_po_ordered_item_id, inspected_at desc);

create table if not exists public.arkline_cmt_material_rolls (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.arkline_cmt_material_inspections(id) on delete cascade,
  roll_no text not null check (btrim(roll_no) <> ''),
  actual_yards numeric(12,2) not null check (actual_yards > 0),
  actual_gsm numeric(12,2) not null check (actual_gsm > 0),
  actual_width_in numeric(12,2) not null check (actual_width_in > 0),
  remarks text,
  total_points integer not null default 0 check (total_points >= 0),
  scored_points integer not null default 0 check (scored_points >= 0),
  points_per_100_sq_yd integer not null default 0 check (points_per_100_sq_yd >= 0),
  grade text not null default 'A' check (grade in ('A', 'B', 'C', 'X')),
  created_at timestamptz not null default now(),
  constraint arkline_cmt_material_rolls_inspection_no_key unique (inspection_id, roll_no)
);

create index if not exists arkline_cmt_material_rolls_inspection_idx
  on public.arkline_cmt_material_rolls (inspection_id);

create table if not exists public.arkline_cmt_material_roll_defects (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.arkline_cmt_material_rolls(id) on delete cascade,
  defect_id uuid not null references public.arkline_cmt_fabric_defects(id) on delete restrict,
  defect_code text not null,
  defect_name text not null,
  position_yards numeric(12,2) not null check (position_yards > 0),
  yard_bucket integer not null check (yard_bucket > 0),
  points smallint not null check (points between 1 and 4),
  created_at timestamptz not null default now()
);

create index if not exists arkline_cmt_material_roll_defects_roll_idx
  on public.arkline_cmt_material_roll_defects (roll_id, yard_bucket);

alter table public.arkline_cmt_material_inspections enable row level security;
alter table public.arkline_cmt_material_rolls enable row level security;
alter table public.arkline_cmt_material_roll_defects enable row level security;

grant select on public.arkline_cmt_material_inspections to authenticated;
grant select on public.arkline_cmt_material_rolls to authenticated;
grant select on public.arkline_cmt_material_roll_defects to authenticated;

create policy arkline_cmt_material_inspections_select
on public.arkline_cmt_material_inspections for select to authenticated
using (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
));

create policy arkline_cmt_material_rolls_select
on public.arkline_cmt_material_rolls for select to authenticated
using (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
));

create policy arkline_cmt_material_roll_defects_select
on public.arkline_cmt_material_roll_defects for select to authenticated
using (exists (
  select 1 from public.dir_user_profiles profile
  where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
    and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
));

create or replace function public.create_arkline_cmt_material_inspection(
  p_material_po_ordered_item_id uuid,
  p_lot text,
  p_nominal_width_in numeric,
  p_nominal_gsm numeric,
  p_remarks text,
  p_rolls jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_item record;
  v_inspection_id uuid;
  v_roll_id uuid;
  v_roll jsonb;
  v_defect jsonb;
  v_defect_master record;
  v_defects jsonb;
  v_roll_no text;
  v_yards numeric(12,2);
  v_width numeric(12,2);
  v_gsm numeric(12,2);
  v_position numeric(12,2);
  v_points integer;
  v_roll_points integer;
  v_roll_scored integer;
  v_roll_score integer;
  v_roll_grade text;
  v_document_points integer := 0;
  v_document_scored integer := 0;
  v_document_area numeric := 0;
  v_document_score integer;
  v_document_grade text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to save a material inspection';
  end if;

  select profile.role, btrim(profile.display_name) as display_name
    into v_profile
  from public.dir_user_profiles profile
  where profile.authenticated_id = (select auth.uid())
     or profile.id = (select auth.uid())::text
  limit 1;

  if coalesce(v_profile.role, '') not in ('admin', 'arkline_merchandiser', 'arkline_host', 'external') then
    raise exception 'Not allowed to create CMT material inspections';
  end if;
  if coalesce(v_profile.display_name, '') = '' then
    raise exception 'Set a profile display name before saving an inspection';
  end if;

  select item.id, item.material_po_ordered_id, item.material_po_number,
         item.material_name_snapshot, header.supplier_name_snapshot, material.material_type
    into v_item
  from public.arkline_po_material_ordered_items item
  join public.arkline_po_material_ordered header on header.id = item.material_po_ordered_id
  join public.arkline_dir_materials material on material.id = item.material_id
  where item.id = p_material_po_ordered_item_id;

  if not found then
    raise exception 'Material PO item not found';
  end if;
  if upper(coalesce(v_item.material_type, '')) <> 'FABRIC' then
    raise exception 'CMT material inspection is only available for Fabric';
  end if;
  if nullif(btrim(coalesce(p_lot, '')), '') is null then
    raise exception 'Lot is required';
  end if;
  if p_nominal_width_in is null or p_nominal_width_in <= 0 or
     p_nominal_gsm is null or p_nominal_gsm <= 0 then
    raise exception 'Nominal width and GSM must be above zero';
  end if;
  if jsonb_typeof(p_rolls) is distinct from 'array' then
    raise exception 'Add at least one roll';
  end if;
  if jsonb_array_length(p_rolls) = 0 then
    raise exception 'Add at least one roll';
  end if;

  insert into public.arkline_cmt_material_inspections (
    material_po_ordered_id, material_po_ordered_item_id, po_number,
    supplier_name, material_name, lot, nominal_width_in, nominal_gsm,
    remarks, inspected_by
  ) values (
    v_item.material_po_ordered_id, v_item.id, v_item.material_po_number,
    coalesce(v_item.supplier_name_snapshot, '-'), coalesce(v_item.material_name_snapshot, '-'),
    btrim(p_lot), p_nominal_width_in, p_nominal_gsm,
    nullif(btrim(coalesce(p_remarks, '')), ''), v_profile.display_name
  ) returning id into v_inspection_id;

  for v_roll in select value from jsonb_array_elements(p_rolls) loop
    v_roll_no := upper(btrim(coalesce(v_roll->>'roll_no', '')));
    v_yards := (v_roll->>'actual_yards')::numeric;
    v_width := (v_roll->>'actual_width_in')::numeric;
    v_gsm := (v_roll->>'actual_gsm')::numeric;
    if v_roll_no = '' or v_yards is null or v_yards <= 0 or
       v_width is null or v_width <= 0 or v_gsm is null or v_gsm <= 0 then
      raise exception 'Every roll needs a number, actual yards, width, and GSM above zero';
    end if;

    v_defects := coalesce(v_roll->'defects', '[]'::jsonb);
    if jsonb_typeof(v_defects) <> 'array' then
      raise exception 'Roll defects must be a list';
    end if;

    insert into public.arkline_cmt_material_rolls (
      inspection_id, roll_no, actual_yards, actual_width_in, actual_gsm, remarks
    ) values (
      v_inspection_id, v_roll_no, v_yards, v_width, v_gsm,
      nullif(btrim(coalesce(v_roll->>'remarks', '')), '')
    ) returning id into v_roll_id;

    v_roll_points := 0;
    for v_defect in select value from jsonb_array_elements(v_defects) loop
      select defect.id, defect.code, defect.defect_name into v_defect_master
      from public.arkline_cmt_fabric_defects defect
      join public.arkline_cmt_fabric_defect_groups defect_group on defect_group.id = defect.group_id
      where defect.id = (v_defect->>'defect_id')::uuid
        and defect.is_active and defect_group.is_active;
      if not found then
        raise exception 'Choose an active Fabric defect';
      end if;

      v_position := (v_defect->>'position_yards')::numeric;
      v_points := (v_defect->>'points')::integer;
      if v_position is null or v_position <= 0 or v_position > v_yards then
        raise exception 'Defect position must be within the actual roll length';
      end if;
      if v_points is null or v_points not between 1 and 4 then
        raise exception 'Each defect must have 1 to 4 points';
      end if;

      insert into public.arkline_cmt_material_roll_defects (
        roll_id, defect_id, defect_code, defect_name, position_yards, yard_bucket, points
      ) values (
        v_roll_id, v_defect_master.id, v_defect_master.code, v_defect_master.defect_name,
        v_position, greatest(1, ceil(v_position)::integer), v_points
      );
      v_roll_points := v_roll_points + v_points;
    end loop;

    select coalesce(sum(least(bucket_points, 4)), 0)::integer into v_roll_scored
    from (
      select sum(points)::integer as bucket_points
      from public.arkline_cmt_material_roll_defects
      where roll_id = v_roll_id
      group by yard_bucket
    ) buckets;

    v_roll_score := ceil(v_roll_scored * 3600 / (v_yards * v_width))::integer;
    v_roll_grade := case
      when v_roll_score < 20 then 'A'
      when v_roll_score < 30 then 'B'
      when v_roll_score <= 40 then 'C'
      else 'X'
    end;

    update public.arkline_cmt_material_rolls
    set total_points = v_roll_points, scored_points = v_roll_scored,
        points_per_100_sq_yd = v_roll_score, grade = v_roll_grade
    where id = v_roll_id;

    v_document_points := v_document_points + v_roll_points;
    v_document_scored := v_document_scored + v_roll_scored;
    v_document_area := v_document_area + v_yards * v_width / 36;
  end loop;

  v_document_score := ceil(v_document_scored * 100 / v_document_area)::integer;
  v_document_grade := case
    when v_document_score < 20 then 'A'
    when v_document_score < 30 then 'B'
    when v_document_score <= 40 then 'C'
    else 'X'
  end;

  update public.arkline_cmt_material_inspections
  set total_points = v_document_points, scored_points = v_document_scored,
      total_area_sq_yd = v_document_area,
      points_per_100_sq_yd = v_document_score, grade = v_document_grade
  where id = v_inspection_id;

  return v_inspection_id;
end;
$$;

revoke all on function public.create_arkline_cmt_material_inspection(uuid, text, numeric, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_arkline_cmt_material_inspection(uuid, text, numeric, numeric, text, jsonb)
  to authenticated;
