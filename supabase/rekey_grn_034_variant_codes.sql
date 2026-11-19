-- One-time correction for unallocated variants on GRN #034-XI2026.
-- Photo objects must first be prepared with scripts/rekey-grn-034-photos.mjs.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.dir_product_model_variants, public.inbound_unload, public.qc_items in share row exclusive mode;

create temporary table grn034_rekey (
  variant_id bigint primary key,
  old_code text not null,
  new_code text not null unique,
  new_photo_url text
) on commit drop;

insert into grn034_rekey (variant_id, old_code, new_code) values
  (1595, 'BKM01LSS017-001', 'BKM01LSS018-002'),
  (1604, 'BKM01LSS016-004', 'BKM01LSS017-001'),
  (1607, 'BKM01LSS019-002', 'BKM01LSS017-002'),
  (1610, 'BKM01LSS018-002', 'BKM01LSS017-003'),
  (1613, 'BKM01LSS015-005', 'BKM01LSS017-004'),
  (1616, 'BKM01LSS014-002', 'BKM01LSS017-005');

do $$
begin
  if (select count(*) from public.dir_product_model_variants v join grn034_rekey r on r.variant_id=v.id and r.old_code=v.variant_code) <> 6
     or exists (
       select 1 from grn034_rekey r
       join public.dir_product_model_variants v on v.id=r.variant_id
       join public.dir_product_models m on m.id=v.product_model_id
       where m.model_code <> split_part(r.new_code, '-', 1)
     )
     or exists (
       select 1 from public.dir_product_model_variants v
       join grn034_rekey r on upper(v.variant_code)=upper(r.new_code)
       where not exists (select 1 from grn034_rekey owner where owner.variant_id=v.id)
     )
     or (select count(*) from public.inbound_unload iu join grn034_rekey r on r.variant_id=iu.product_model_variant_id where iu.inbound_id=34) <> 6
     or exists (
       select 1 from public.qc_items q
       where q.product_model_variant_id in (select variant_id from grn034_rekey)
          or q.inbound_unload_id in (
            select iu.id from public.inbound_unload iu
            join grn034_rekey r on r.variant_id=iu.product_model_variant_id
          )
     ) then
    raise exception 'Variant identities, model ownership, inbound rows, or QC allocation changed; aborting rekey';
  end if;
end $$;

update grn034_rekey r
set new_photo_url = regexp_replace(split_part(v.variant_photo_url, '?', 1), '[^/]+$', lower(r.new_code) || '.jpg')
                    || '?rev=20261118-grn034'
from public.dir_product_model_variants v
where v.id=r.variant_id;

do $$
begin
  if exists (
    select 1 from grn034_rekey r
    where r.new_photo_url is null
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id='product-photos'
           and o.name=split_part(split_part(r.new_photo_url, '/product-photos/', 2), '?', 1)
       )
  ) then
    raise exception 'One or more prepared photos are missing from Storage';
  end if;
end $$;

-- Stage temporary codes because the desired 017-001 and 018-002 are currently occupied.
update public.dir_product_model_variants v
set variant_code='__GRN034_REKEY_' || v.id
from grn034_rekey r
where v.id=r.variant_id;

update public.dir_product_model_variants v
set variant_code=r.new_code,
    variant_photo_url=r.new_photo_url,
    updated_at=now(),
    updated_by='SYSTEM: GRN #034 SKU correction'
from grn034_rekey r
where v.id=r.variant_id;

update public.inbound_unload iu
set photo_url=r.new_photo_url,
    updated_at=now()
from grn034_rekey r
where iu.inbound_id=34 and iu.product_model_variant_id=r.variant_id;

do $$
begin
  if (select count(*) from grn034_rekey r join public.dir_product_model_variants v
      on v.id=r.variant_id and v.variant_code=r.new_code and v.variant_photo_url=r.new_photo_url) <> 6
     or (select count(*) from grn034_rekey r join public.inbound_unload iu
      on iu.inbound_id=34 and iu.product_model_variant_id=r.variant_id and iu.photo_url=r.new_photo_url) <> 6 then
    raise exception 'Variant rekey verification failed';
  end if;
end $$;
commit;
