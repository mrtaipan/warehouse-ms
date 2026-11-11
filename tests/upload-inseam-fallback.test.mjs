import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const readSql = async (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8')

test('upload SQL prefers exact waist, then same-waist inseams, and can be reapplied', async () => {
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;')
    await db.exec(await readSql('warehouse_stock_size_matching.sql'))
    await db.exec(`
      create table warehouse_temporary_sales_items (id integer primary key, size text, entered_at timestamptz);
      create table warehouse_storage (id integer primary key, size text, created_at timestamptz);
      create function settle_mob_sales_import_batch(p_batch_id uuid, p_actor_email text)
      returns jsonb language plpgsql as $body$
      declare import_line record;
      begin
        select '32'::text as size, null::text as variation_raw into import_line;
        perform temporary_item.id from warehouse_temporary_sales_items temporary_item
          where public.warehouse_sizes_match(temporary_item.size, import_line.size, import_line.variation_raw)
          order by temporary_item.entered_at asc nulls first, temporary_item.id asc;
        perform storage.id from warehouse_storage storage
          where public.warehouse_sizes_match(storage.size, import_line.size, import_line.variation_raw)
          order by storage.created_at asc nulls first, storage.id asc;
        return '{}'::jsonb;
      end;
      $body$;
      create function retry_upload_sales_import_batch(p_batch_id uuid, p_actor_email text)
      returns jsonb language plpgsql as $body$
      declare import_line record;
      begin
        select '32'::text as size, null::text as variation_raw into import_line;
        perform temporary_item.id from warehouse_temporary_sales_items temporary_item
          where public.warehouse_sizes_match(temporary_item.size, import_line.size, import_line.variation_raw)
          order by temporary_item.entered_at asc nulls first, temporary_item.id asc;
        perform storage.id from warehouse_storage storage
          where public.warehouse_sizes_match(storage.size, import_line.size, import_line.variation_raw)
          order by storage.created_at asc nulls first, storage.id asc;
        return '{}'::jsonb;
      end;
      $body$;
    `)

    const migration = await readSql('upload_sales_import_inseam_fallback.sql')
    await db.exec(migration)
    await db.exec(migration)

    const { rows } = await db.query(`
      select public.warehouse_upload_size_priority('32', '32') as exact,
        public.warehouse_upload_size_priority('32x30', '32') as fallback,
        public.warehouse_upload_size_priority('34x30', '32') as wrong_waist,
        public.warehouse_upload_size_priority('32', '32x30') as wrong_direction
    `)
    assert.deepEqual(rows[0], { exact: 0, fallback: 1, wrong_waist: null, wrong_direction: null })

    const { rows: definitions } = await db.query(`
      select pg_get_functiondef('settle_mob_sales_import_batch(uuid,text)'::regprocedure) as settle,
        pg_get_functiondef('retry_upload_sales_import_batch(uuid,text)'::regprocedure) as retry
    `)
    for (const definition of Object.values(definitions[0])) {
      assert.match(definition, /warehouse_upload_size_priority\(storage\.size/)
      assert.match(definition, /warehouse_upload_size_priority\(temporary_item\.size/)
      assert.doesNotMatch(definition, /warehouse_sizes_match\(storage\.size/)
    }
  } finally {
    await db.close()
  }
})
