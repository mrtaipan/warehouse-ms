begin;

do $$
declare
  v_host_profile_id text;
  v_host_display_name text;
  v_matching_profiles integer;
  v_wearing_product_sku text;
  v_existing_session_id bigint;
  v_run_id bigint;
  v_session_id bigint;
  v_started_at timestamptz := timestamptz '2026-09-25 22:00:00+07';
  v_ended_at timestamptz := timestamptz '2026-09-26 01:00:00+07';
  v_gross_amount numeric(18,2) := 2589958;
begin
  select count(*)
    into v_matching_profiles
  from public.dir_user_profiles
  where lower(trim(display_name)) = lower('Donny Damara')
    and lower(trim(role)) = 'arkline_host';

  if v_matching_profiles = 0 then
    raise exception 'Arkline host profile with display_name Donny Damara was not found';
  end if;

  if v_matching_profiles > 1 then
    raise exception 'More than one profile uses display_name Donny Damara';
  end if;

  select id, display_name
    into v_host_profile_id, v_host_display_name
  from public.dir_user_profiles
  where lower(trim(display_name)) = lower('Donny Damara')
    and lower(trim(role)) = 'arkline_host'
  limit 1;

  select upper(trim(sku_induk))
    into v_wearing_product_sku
  from public.arkline_dir_products
  where upper(trim(sku_induk)) = upper('ark01Hdo042')
  limit 1;

  if v_wearing_product_sku is null then
    raise exception 'Wearing product SKU ARK01HDO042 was not found';
  end if;

  select session_row.id
    into v_existing_session_id
  from public.arkline_live_reporting_sessions session_row
  where session_row.host_profile_id = v_host_profile_id
    and session_row.session_date = date '2026-09-25'
    and session_row.start_time = time '22:00:00'
    and session_row.end_time = time '01:00:00'
    and session_row.session_type = 'STANDALONE'
    and session_row.sales_channel = 'SHOPEE'
  limit 1;

  if v_existing_session_id is not null then
    raise notice 'Historical session already exists with id %. No duplicate was inserted.', v_existing_session_id;
    return;
  end if;

  insert into public.arkline_live_reporting_runs (
    sales_channel,
    status,
    started_by_profile_id,
    started_by_display_name_snapshot,
    current_gross_amount,
    started_at,
    ended_at,
    created_at,
    updated_at
  )
  values (
    'SHOPEE',
    'ENDED',
    v_host_profile_id,
    v_host_display_name,
    v_gross_amount,
    v_started_at,
    v_ended_at,
    v_ended_at,
    v_ended_at
  )
  returning id into v_run_id;

  insert into public.arkline_live_reporting_sessions (
    live_run_id,
    checkpoint_no,
    session_date,
    end_date,
    start_time,
    end_time,
    session_type,
    sales_channel,
    host_profile_id,
    host_display_name_snapshot,
    partner_profile_id,
    partner_display_name_snapshot,
    wearing_product_sku,
    partner_wearing_product_sku,
    gross_amount,
    previous_gross_amount,
    incremental_amount,
    created_at,
    updated_at
  )
  values (
    v_run_id,
    1,
    date '2026-09-25',
    date '2026-09-26',
    time '22:00:00',
    time '01:00:00',
    'STANDALONE',
    'SHOPEE',
    v_host_profile_id,
    v_host_display_name,
    null,
    null,
    v_wearing_product_sku,
    null,
    v_gross_amount,
    0,
    v_gross_amount,
    v_ended_at,
    v_ended_at
  )
  returning id into v_session_id;

  insert into public.arkline_live_reporting_credits (
    session_id,
    host_profile_id,
    host_display_name_snapshot,
    credited_amount,
    created_at
  )
  values (
    v_session_id,
    v_host_profile_id,
    v_host_display_name,
    v_gross_amount,
    v_ended_at
  );

  raise notice 'Historical live session inserted. Run id: %, session id: %', v_run_id, v_session_id;
end;
$$;

commit;

select
  session_row.id as session_id,
  run_row.id as live_run_id,
  run_row.status as live_run_status,
  session_row.sales_channel,
  session_row.session_type,
  session_row.host_display_name_snapshot as host_name,
  session_row.session_date,
  session_row.start_time,
  session_row.end_date,
  session_row.end_time,
  session_row.wearing_product_sku,
  session_row.gross_amount,
  session_row.incremental_amount,
  credit_row.credited_amount
from public.arkline_live_reporting_sessions session_row
join public.arkline_live_reporting_runs run_row
  on run_row.id = session_row.live_run_id
left join public.arkline_live_reporting_credits credit_row
  on credit_row.session_id = session_row.id
where lower(trim(session_row.host_display_name_snapshot)) = lower('Donny Damara')
  and session_row.session_date = date '2026-09-25'
  and session_row.start_time = time '22:00:00'
  and session_row.sales_channel = 'SHOPEE';
