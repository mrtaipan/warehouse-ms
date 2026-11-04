-- Keep Arkline product labels canonical and make master-name changes cascade to products.
update public.arkline_dir_products
set kategori_pengadaan = upper(btrim(kategori_pengadaan)),
    kategori_produk = upper(btrim(kategori_produk))
where kategori_pengadaan is distinct from upper(btrim(kategori_pengadaan))
   or kategori_produk is distinct from upper(btrim(kategori_produk));

alter table public.arkline_dir_products
  add constraint arkline_dir_products_kategori_pengadaan_upper_check
    check (kategori_pengadaan is null or (kategori_pengadaan = upper(btrim(kategori_pengadaan)) and kategori_pengadaan <> '')),
  add constraint arkline_dir_products_kategori_produk_upper_check
    check (kategori_produk is null or (kategori_produk = upper(btrim(kategori_produk)) and kategori_produk <> '')),
  add constraint arkline_dir_products_kategori_pengadaan_fkey
    foreign key (kategori_pengadaan)
    references public.arkline_dir_procurement_categories(category_name)
    on update cascade on delete restrict;

create index arkline_dir_products_kategori_pengadaan_idx
  on public.arkline_dir_products (kategori_pengadaan);
