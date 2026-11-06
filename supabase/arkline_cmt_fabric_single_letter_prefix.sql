-- Preserve legacy rows while enforcing one letter on new writes.
alter table public.arkline_cmt_fabric_defect_groups
  drop constraint if exists arkline_cmt_fabric_defect_group_prefix_check,
  add constraint arkline_cmt_fabric_defect_group_prefix_check
    check (code_prefix ~ '^[A-Z]$') not valid;
