-- Let the company leader read only the 30-day packaging consumption summary.
-- Run after packaging_supplies.sql.
begin;

create or replace function public.packaging_outbound_30d()
returns table(item_id bigint, out_qty bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not (
    public.reqc_has_permission('storage.location.view')
    or exists (
      select 1 from public.dir_user_profiles profile
      where profile.authenticated_id = (select auth.uid())
        and lower(profile.role) = 'leader'
    )
  ) then
    raise exception 'Not allowed to read packaging consumption';
  end if;
  return query
    select movement.item_id, sum(-movement.qty_change)::bigint
    from public.packaging_movements movement
    where movement.movement_type = 'OUT'
      and movement.created_at >= now() - interval '30 days'
    group by movement.item_id;
end;
$$;

revoke all on function public.packaging_outbound_30d() from public, anon;
grant execute on function public.packaging_outbound_30d() to authenticated;

commit;
