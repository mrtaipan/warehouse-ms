-- Keep material PO references in sync when a temporary garment PO gets its final number.
create index if not exists arkline_material_pos_garment_po_number_idx
  on public.arkline_po_material_ordered (garment_po_number);

create index if not exists arkline_material_order_items_source_po_id_idx
  on public.arkline_po_material_ordered_items (source_po_id);

alter table public.arkline_po_material_ordered
  drop constraint if exists arkline_po_material_ordered_garment_po_number_fkey;

alter table public.arkline_po_material_ordered
  add constraint arkline_po_material_ordered_garment_po_number_fkey
  foreign key (garment_po_number) references public.arkline_pos (po_id)
  on update cascade;

alter table public.arkline_po_material_ordered_items
  drop constraint if exists arkline_po_material_ordered_items_source_po_id_fkey;

alter table public.arkline_po_material_ordered_items
  add constraint arkline_po_material_ordered_items_source_po_id_fkey
  foreign key (source_po_id) references public.arkline_pos (po_id)
  on update cascade;

alter table public.arkline_po_materials
  drop constraint if exists arkline_po_materials_po_id_fkey;

alter table public.arkline_po_materials
  add constraint arkline_po_materials_po_id_fkey
  foreign key (po_id) references public.arkline_pos (po_id)
  on update cascade;

alter table public.arkline_po_material_logs
  drop constraint if exists arkline_po_material_logs_po_id_fkey;

alter table public.arkline_po_material_logs
  add constraint arkline_po_material_logs_po_id_fkey
  foreign key (po_id) references public.arkline_pos (po_id)
  on update cascade;
