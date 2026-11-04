-- Product and PO item procurement names both follow master category renames.
alter table public.arkline_po_items
  drop constraint arkline_po_items_kategori_pengadaan_fkey,
  add constraint arkline_po_items_kategori_pengadaan_fkey
    foreign key (kategori_pengadaan)
    references public.arkline_dir_procurement_categories(category_name)
    on update cascade on delete restrict;
