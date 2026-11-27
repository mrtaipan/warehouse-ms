import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const actor = '00000000-0000-0000-0000-000000000001'

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$
    select nullif(current_setting('test.actor', true), '')::uuid
  $$;
  set test.actor = '${actor}';
  create table warehouse_loans (
    id uuid primary key default gen_random_uuid(),
    group_code text, purpose text, requester_id uuid, request_note text
  );
  create function create_warehouse_loan(p_group text, p_purpose text, p_items jsonb)
  returns uuid language plpgsql as $$
  declare v_id uuid;
  begin
    insert into public.warehouse_loans(group_code, purpose, requester_id)
    values (p_group, p_purpose, auth.uid()) returning id into v_id;
    return v_id;
  end;
  $$;
`)

const migration = await readFile(new URL('../supabase/warehouse_loan_request_note.sql', import.meta.url), 'utf8')
await db.exec(migration)

test('new loan keeps a trimmed optional note on its header', async () => {
  const { rows } = await db.query(
    "select create_warehouse_loan('MOB','Photoshoot','[]'::jsonb,'  Shoot in studio B  ') as id"
  )
  const saved = await db.query('select request_note from warehouse_loans where id=$1', [rows[0].id])
  assert.equal(saved.rows[0].request_note, 'Shoot in studio B')
})

test('empty note remains null and the old API remains usable', async () => {
  const { rows } = await db.query(
    "select create_warehouse_loan('OI','Content','[]'::jsonb,'  ') as id"
  )
  const old = await db.query("select create_warehouse_loan('OI','Sample','[]'::jsonb) as id")
  const saved = await db.query('select request_note from warehouse_loans where id in ($1,$2)', [rows[0].id, old.rows[0].id])
  assert.equal(saved.rows.length, 2)
  assert.ok(saved.rows.every((row) => row.request_note === null))
})

test('oversized note is rejected without creating a loan', async () => {
  const before = await db.query('select count(*)::integer as count from warehouse_loans')
  await assert.rejects(
    () => db.query("select create_warehouse_loan('MOB','Sample','[]'::jsonb,$1)", ['x'.repeat(2001)]),
    /2000 characters/
  )
  const after = await db.query('select count(*)::integer as count from warehouse_loans')
  assert.equal(after.rows[0].count, before.rows[0].count)
})
