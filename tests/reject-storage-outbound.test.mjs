import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const modulePath = process.env.PGLITE_TEST_MODULE
const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : '@electric-sql/pglite')
const db = new PGlite()

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql as $$ select '{"email":"tester@example.com"}'::jsonb $$;
  set test.actor = '00000000-0000-0000-0000-000000000001';
  create table dir_user_profiles (authenticated_id uuid, role text);
  create table dir_user_roles (role text, permission_code text);
  insert into dir_user_profiles values (auth.uid(), 'storage_coordinator');
  create table warehouse_reject_storage (id bigint primary key, qty integer not null, status text not null);
  create table arkline_qc_rejection_storage_batches (id uuid primary key, status text not null);
  create table arkline_qc_rejection_storage_lines (id uuid primary key, storage_batch_id uuid references arkline_qc_rejection_storage_batches(id), qty integer not null);
  insert into warehouse_reject_storage values (1, 5, 'POSTED'), (2, 3, 'DRAFT'), (3, 2, 'POSTED'), (4, 4, 'POSTED');
  insert into arkline_qc_rejection_storage_batches values ('00000000-0000-0000-0000-000000000010', 'STORED');
  insert into arkline_qc_rejection_storage_lines values
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000010', 4),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000010', 2);
`)
await db.exec(await readFile(new URL('../supabase/reject_storage_outbound.sql', import.meta.url), 'utf8'))

async function release(source, id, qty, reason = 'Sent to vendor') {
  return db.query('select release_reject_storage_item($1, $2, $3, $4, $5)', [source, id, qty, reason, 'Vendor'])
}

test('regular reject can be released partially, but never beyond its balance', async () => {
  await release('REGULAR', '1', 2)
  await release('REGULAR', '1', 3)
  await assert.rejects(release('REGULAR', '1', 1), /Only 0 unit/)
  const result = await db.query('select sum(qty)::integer as released, count(*)::integer as movements from warehouse_reject_storage_outbounds where regular_reject_id = 1')
  assert.deepEqual(result.rows[0], { released: 5, movements: 2 })
})

test('draft items cannot be released', async () => {
  await assert.rejects(release('REGULAR', '2', 1), /Posted regular reject item was not found/)
})

test('Arkline reject line uses its own balance and requires a reason', async () => {
  const id = '00000000-0000-0000-0000-000000000011'
  await release('ARKLINE', id, 3)
  await assert.rejects(release('ARKLINE', id, 2), /Only 1 unit/)
  await assert.rejects(release('ARKLINE', id, 1, ' '), /reason is required/)
  const result = await db.query('select qty, released_by from warehouse_reject_storage_outbounds where arkline_line_id = $1', [id])
  assert.deepEqual(result.rows[0], { qty: 3, released_by: 'tester@example.com' })
})

test('release selection allocates across rows atomically', async () => {
  await db.query('select release_reject_storage_selection($1, $2::text[], $3, $4)', ['REGULAR', ['3', '4'], 5, 'Disposed'])
  const result = await db.query('select regular_reject_id, qty from warehouse_reject_storage_outbounds where regular_reject_id in (3, 4) order by regular_reject_id')
  assert.deepEqual(result.rows, [{ regular_reject_id: 3, qty: 2 }, { regular_reject_id: 4, qty: 3 }])
  await assert.rejects(db.query('select release_reject_storage_selection($1, $2::text[], $3, $4)', ['REGULAR', ['3', '4'], 2, 'Disposed']), /Only 1 unit/)
  const remaining = await db.query('select sum(qty)::integer as released from warehouse_reject_storage_outbounds where regular_reject_id in (3, 4)')
  assert.equal(remaining.rows[0].released, 5)
})

test('Arkline selection also spans lines with the same product and size', async () => {
  const ids = ['00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012']
  await db.query('select release_reject_storage_selection($1, $2::text[], $3, $4)', ['ARKLINE', ids, 2, 'Returned to supplier'])
  const result = await db.query('select arkline_line_id, sum(qty)::integer as released from warehouse_reject_storage_outbounds where arkline_line_id = any($1::uuid[]) group by arkline_line_id order by arkline_line_id', [ids])
  assert.deepEqual(result.rows, [
    { arkline_line_id: ids[0], released: 4 },
    { arkline_line_id: ids[1], released: 1 },
  ])
})

test('unprivileged user cannot release items', async () => {
  await db.exec("set test.actor = '00000000-0000-0000-0000-000000000002'")
  await assert.rejects(release('REGULAR', '1', 1), /Not allowed/)
})
