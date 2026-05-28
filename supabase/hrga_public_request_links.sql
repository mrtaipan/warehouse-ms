begin;

alter table public.hrga_leave_requests
  add column if not exists request_link_signature text null;

alter table public.hrga_birthday_gift
  add column if not exists request_link_signature text null;

create unique index if not exists hrga_leave_requests_request_link_signature_idx
  on public.hrga_leave_requests (request_link_signature)
  where request_link_signature is not null;

create unique index if not exists hrga_birthday_gift_request_link_signature_idx
  on public.hrga_birthday_gift (request_link_signature)
  where request_link_signature is not null;

create or replace function public.submit_signed_hrga_request(
  p_payload text,
  p_signature text,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_request_date date,
  p_item_name text,
  p_size text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  request_type text;
  employee_authenticated_id_value uuid;
  employee_name_value text;
  employee_email_value text;
  note_lines text;
begin
  if coalesce(trim(p_payload), '') = '' or coalesce(trim(p_signature), '') = '' then
    raise exception 'Invalid request link.';
  end if;

  if exists (
    select 1
    from public.hrga_leave_requests
    where request_link_signature = trim(p_signature)
  ) or exists (
    select 1
    from public.hrga_birthday_gift
    where request_link_signature = trim(p_signature)
  ) then
    raise exception 'This request link has already been used.';
  end if;

  payload := convert_from(decode(trim(p_payload), 'hex'), 'utf8')::jsonb;
  request_type := upper(coalesce(payload ->> 'type', ''));

  if request_type not in ('LEAVE', 'BIRTHDAY') then
    raise exception 'Invalid request type.';
  end if;

  if (payload ->> 'authenticated_id') is not null and payload ->> 'authenticated_id' <> '' then
    employee_authenticated_id_value := (payload ->> 'authenticated_id')::uuid;
  else
    employee_authenticated_id_value := null;
  end if;

  employee_name_value := coalesce(payload ->> 'display_name', 'Team');
  employee_email_value := nullif(payload ->> 'email', '');

  if request_type = 'LEAVE' then
    if p_start_date is null or p_end_date is null or coalesce(trim(p_reason), '') = '' then
      raise exception 'Dates and reason are required.';
    end if;

    if p_end_date < p_start_date then
      raise exception 'End date cannot be earlier than start date.';
    end if;

    insert into public.hrga_leave_requests (
      employee_authenticated_id,
      employee_name_snapshot,
      employee_email_snapshot,
      request_type,
      start_date,
      end_date,
      reason,
      status,
      request_link_signature
    )
    values (
      employee_authenticated_id_value,
      employee_name_value,
      employee_email_value,
      'LEAVE',
      p_start_date,
      p_end_date,
      trim(p_reason),
      'SUBMITTED',
      trim(p_signature)
    );
  else
    if p_request_date is null or coalesce(trim(p_item_name), '') = '' then
      raise exception 'Request date and item name are required.';
    end if;

    note_lines := 'Item Name: ' || trim(p_item_name);
    if coalesce(trim(p_size), '') <> '' then
      note_lines := note_lines || E'\nSize: ' || upper(trim(p_size));
    end if;

    insert into public.hrga_birthday_gift (
      employee_authenticated_id,
      employee_name_snapshot,
      employee_email_snapshot,
      request_date,
      notes,
      status,
      request_link_signature
    )
    values (
      employee_authenticated_id_value,
      employee_name_value,
      employee_email_value,
      p_request_date,
      note_lines,
      'SUBMITTED',
      trim(p_signature)
    );
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.is_signed_hrga_request_used(p_signature text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.hrga_leave_requests
    where request_link_signature = trim(p_signature)
  ) or exists (
    select 1
    from public.hrga_birthday_gift
    where request_link_signature = trim(p_signature)
  );
$$;

create or replace function public.get_public_hrga_holidays()
returns table (
  holiday_date date,
  holiday_name text,
  notes text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    holiday.holiday_date,
    holiday.holiday_name,
    holiday.notes
  from public.hrga_public_holidays holiday
  order by holiday.holiday_date asc;
$$;

grant execute on function public.submit_signed_hrga_request(text, text, date, date, text, date, text, text) to anon, authenticated;
grant execute on function public.is_signed_hrga_request_used(text) to anon, authenticated;
grant execute on function public.get_public_hrga_holidays() to anon, authenticated;

commit;
