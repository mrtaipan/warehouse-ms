do $migration$
declare
  definition text;
  begin_at integer;
  end_at integer;
begin
  select pg_get_functiondef('public.create_arkline_cmt_material_inspection(uuid,text,numeric,numeric,text,jsonb)'::regprocedure) into definition;
  begin_at := position('    select coalesce(sum(least(bucket_points, 4)), 0)::integer into v_roll_scored' in definition);
  end_at := position('    v_roll_score :=' in definition);
  if begin_at = 0 or end_at <= begin_at then
    raise exception 'Unexpected fabric inspection function definition';
  end if;
  definition := left(definition, begin_at - 1) ||
    '    v_roll_scored := v_roll_points;' || E'\n\n' ||
    substring(definition from end_at);
  execute definition;
end;
$migration$;

with roll_totals as (
  select r.id, coalesce(sum(d.points), 0)::integer as total_pts,
    ceil(coalesce(sum(d.points), 0) * 3600 / (r.actual_yards * r.actual_width_in))::integer as normalized_pts
  from public.arkline_cmt_material_rolls r
  left join public.arkline_cmt_material_roll_defects d on d.roll_id = r.id
  group by r.id, r.actual_yards, r.actual_width_in
)
update public.arkline_cmt_material_rolls r
set total_points = totals.total_pts,
    scored_points = totals.total_pts,
    points_per_100_sq_yd = totals.normalized_pts,
    grade = case when totals.normalized_pts < 20 then 'A'
                 when totals.normalized_pts < 30 then 'B'
                 when totals.normalized_pts <= 40 then 'C'
                 else 'X' end
from roll_totals totals
where r.id = totals.id;

with document_totals as (
  select inspection_id, sum(total_points)::integer as total_pts,
    sum(actual_yards * actual_width_in / 36) as total_area_sq_yd
  from public.arkline_cmt_material_rolls
  group by inspection_id
), document_scores as (
  select inspection_id, total_pts, total_area_sq_yd,
    ceil(total_pts * 100 / total_area_sq_yd)::integer as normalized_pts
  from document_totals
)
update public.arkline_cmt_material_inspections inspection
set total_points = scores.total_pts,
    scored_points = scores.total_pts,
    total_area_sq_yd = scores.total_area_sq_yd,
    points_per_100_sq_yd = scores.normalized_pts,
    grade = case when scores.normalized_pts < 20 then 'A'
                 when scores.normalized_pts < 30 then 'B'
                 when scores.normalized_pts <= 40 then 'C'
                 else 'X' end
from document_scores scores
where inspection.id = scores.inspection_id;
