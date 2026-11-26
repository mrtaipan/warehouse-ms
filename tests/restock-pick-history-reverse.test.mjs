import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const actorId = '00000000-0000-0000-0000-000000000001'
const reverseId = '00000000-0000-0000-0000-000000000101'
const cancelledId = '00000000-0000-0000-0000-000000000102'
const creditedId = '00000000-0000-0000-0000-000000000103'
const storedId = '00000000-0000-0000-0000-000000000104'
const linkedId = '00000000-0000-0000-0000-000000000105'
const legacyId = '00000000-0000-0000-0000-000000000106'

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$
    select nullif(current_setting('test.actor', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql as $$
    select jsonb_build_object('email', 'leader@example.com')
  $$;
  set test.actor = '${actorId}';
  create table dir_user_profiles (authenticated_id uuid, role text);
  create table dir_user_roles (role text, permission_code text);
  insert into dir_user_profiles values ('${actorId}', 'warehouse_leader');
  create table restock_request (
    id uuid primary key, requester_user_id uuid, item_name text, size text,
    qty integer, take_from text, search_term text, request_status text,
    destination_area text, return_case_id bigint, rejected_qty integer,
    storage_id text, source_sku_id text, fulfilled_qty integer,
    sales_upload_credited_qty integer default 0, completed_by text,
    completed_at timestamptz, created_at timestamptz default now()
  );
  create table dir_rack_locations (
    id bigint primary key, location_type text, location_id text,
    location_code text, sub_location text
  );
  insert into dir_rack_locations values (1, 'PALLET', 'A', null, null);
  create table warehouse_storage (
    id bigint primary key, rack_location_id bigint, sku_id text, source_variant_code text,
    qty numeric, updated_by text, updated_at timestamptz
  );
  create table warehouse_shelving_queue (
    id bigint primary key, restock_request_id uuid, status text, qty integer
  );
  create table warehouse_temporary_sales_items (restock_request_id uuid);
  create table upload_arkline_pick_offsets (restock_request_id uuid);
  create table warehouse_storage_movements (
    id bigint generated always as identity primary key,
    warehouse_storage_id bigint, movement_type text,
    qty numeric, from_location_label text, to_location_label text,
    item_name text, size text, sku_id text, created_by text,
    created_at timestamptz default now(),
    constraint warehouse_storage_movements_type_check check (movement_type in ('MOVE'))
  );
  insert into warehouse_storage values (1, 1, 'SKU-1', null, 5, null, null);
  insert into restock_request
    (id, requester_user_id, item_name, size, qty, take_from, search_term,
     request_status, destination_area, storage_id, source_sku_id, fulfilled_qty,
     completed_by, completed_at)
  values
    ('${reverseId}', '${actorId}', 'Item 1', 'M', 2, 'PALLET / A', 'SKU-1',
     'completed', 'PICKER', '1', 'SKU-1', 3, 'picker@example.com', now()),
    ('${cancelledId}', '${actorId}', 'Item 2', 'L', 1, 'PALLET / A', 'SKU-2',
     'cancelled', 'PICKER', null, null, null, null, null),
    ('${creditedId}', '${actorId}', 'Item 3', 'M', 1, 'PALLET / A', 'SKU-1',
     'completed', 'PICKER', '1', 'SKU-1', 1, 'picker@example.com', now()),
    ('${storedId}', '${actorId}', 'Item 4', 'M', 1, 'PALLET / A', 'SKU-1',
     'completed', 'PICKER', '1', 'SKU-1', 2, 'picker@example.com', now()),
    ('${legacyId}', '${actorId}', 'Old pick', 'M', 2, 'PALLET / A', 'SKU-1',
     'completed', 'PICKER', '1', 'SKU-1', null, 'picker@example.com', now());
  insert into restock_request
    (id, requester_user_id, item_name, size, qty, take_from, search_term,
     request_status, destination_area, return_case_id)
  values ('${linkedId}', '${actorId}', 'Return item', 'L', 1, 'Pallet', 'RETURN-1',
          'cancelled', 'RETUR_KEEPING', 42);
  update restock_request set sales_upload_credited_qty = 1 where id = '${creditedId}';
  insert into warehouse_shelving_queue values (1, '${reverseId}', 'WAITING_SHELVING', 1);
  insert into warehouse_shelving_queue values (2, '${storedId}', 'STORED', 1);
`)

const migration = await readFile(new URL('../supabase/restock_pick_history_reverse.sql', import.meta.url), 'utf8')
await db.exec(migration)
await db.exec(`
  create trigger restock_request_guard_mutation_trigger
  before insert or update or delete on restock_request
  for each row execute function restock_request_guard_mutation();
`)

async function scalar(query) {
  return Object.values((await db.query(query)).rows[0])[0]
}

test('only admin and warehouse_leader may reverse a pick', async () => {
  await db.exec(`update dir_user_profiles set role = 'storage_staff' where authenticated_id = '${actorId}'`)
  await assert.rejects(() => db.query('select reverse_restock_pick($1)', [reverseId]), /Only admin or warehouse leader/)
  assert.equal(Number(await scalar('select qty from warehouse_storage where id = 1')), 5)
  await db.exec(`update dir_user_profiles set role = 'warehouse_leader' where authenticated_id = '${actorId}'`)
})

test('reverse restores actual picked quantity, removes pending excess, and leaves an audit pair', async () => {
  await db.query('select reverse_restock_pick($1)', [reverseId])
  assert.equal(Number(await scalar('select qty from warehouse_storage where id = 1')), 8)
  assert.equal(Number(await scalar(`select count(*) from warehouse_shelving_queue where restock_request_id = '${reverseId}'`)), 0)
  assert.equal(Number(await scalar(`select count(*) from restock_request where id = '${reverseId}'`)), 0)
  assert.equal(Number(await scalar("select count(*) from warehouse_storage_movements where movement_type in ('RESTOCK_OUT', 'RESTOCK_REVERSE_IN')")), 2)
})

test('cancelled picker request can be deleted without changing stock', async () => {
  await db.query('select delete_cancelled_restock_pick($1)', [cancelledId])
  assert.equal(Number(await scalar(`select count(*) from restock_request where id = '${cancelledId}'`)), 0)
  assert.equal(Number(await scalar('select qty from warehouse_storage where id = 1')), 8)
})

test('credited pick is blocked without changing stock', async () => {
  await assert.rejects(() => db.query('select reverse_restock_pick($1)', [creditedId]), /already affects upload/)
  assert.equal(Number(await scalar(`select count(*) from restock_request where id = '${creditedId}'`)), 1)
  assert.equal(Number(await scalar('select qty from warehouse_storage where id = 1')), 8)
})

test('a placed excess cannot be reversed and remains linked to its pick', async () => {
  await assert.rejects(() => db.query('select reverse_restock_pick($1)', [storedId]), /already placed or changed/)
  assert.equal(Number(await scalar(`select count(*) from restock_request where id = '${storedId}'`)), 1)
  assert.equal(Number(await scalar('select qty from warehouse_storage where id = 1')), 8)
})

test('cancelled return-case request cannot be deleted', async () => {
  await assert.rejects(() => db.query('select delete_cancelled_restock_pick($1)', [linkedId]), /unrelated cancelled picker/)
  assert.equal(Number(await scalar(`select count(*) from restock_request where id = '${linkedId}'`)), 1)
})

test('older pick requires confirmed actual quantity before restoration', async () => {
  await assert.rejects(() => db.query('select reverse_restock_pick($1)', [legacyId]), /actual picked quantity/)
  await db.query('select reverse_restock_pick($1, $2)', [legacyId, 1])
  assert.equal(Number(await scalar('select qty from warehouse_storage where id = 1')), 9)
  assert.equal(Number(await scalar(`select count(*) from restock_request where id = '${legacyId}'`)), 0)
})
