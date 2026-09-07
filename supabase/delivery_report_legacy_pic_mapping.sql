-- Delivery Report legacy PIC mapping for the data migration step.
-- Legacy Apps Script data stores PIC as initials, while the WMS delivery tables
-- now reference public.dir_user_profiles(display_name).
--
-- Apply this mapping when importing legacy rows into the creator column:
--   - public.delivery_error_retur_cases.created_by
--   - public.delivery_order_issue_cases.created_by
--
-- The legacy pic column can remain available for historical compatibility, but
-- WMS access/filtering and foreign keys should use created_by as the case owner.
--
-- Migration rule:
-- 1. Use the explicit legacy_pic mapping below first.
-- 2. If the legacy PIC is not listed, fall back by group_order:
--    - ARKLINE -> HALIMAH MUNISAH SADIYYAH
--    - MOB     -> WIDIA FITALOCA
--    - OI      -> FITRIA SALSABILA
--
-- display_name                 legacy_pic
-- HALIMAH MUNISAH SADIYYAH     AN
-- WIDIA FITALOCA               WF
-- USWATUN HASANAH              US
-- NURLAILA SARI                NLS
-- FITRIA SALSABILA             FS
-- WINDA SINTIA                 WS
-- LASTRIA SEPTIYANTI           LS

with legacy_pic_mapping(display_name, legacy_pic) as (
  values
    ('HALIMAH MUNISAH SADIYYAH', 'AN'),
    ('WIDIA FITALOCA', 'WF'),
    ('USWATUN HASANAH', 'US'),
    ('NURLAILA SARI', 'NLS'),
    ('FITRIA SALSABILA', 'FS'),
    ('WINDA SINTIA', 'WS'),
    ('LASTRIA SEPTIYANTI', 'LS')
)
select *
from legacy_pic_mapping;

-- Example expression for migration SELECT/INSERT statements:
--
-- coalesce(
--   legacy_pic_mapping.display_name,
--   case upper(trim(source_row.group_order))
--     when 'ARKLINE' then 'HALIMAH MUNISAH SADIYYAH'
--     when 'MOB' then 'WIDIA FITALOCA'
--     when 'OI' then 'FITRIA SALSABILA'
--     else null
--   end
-- ) as created_by
