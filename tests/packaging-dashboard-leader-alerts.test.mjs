import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('company leader can read packaging consumption summary without storage permission', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role authenticated;
      create role anon;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
      create function public.reqc_has_permission(text) returns boolean language sql as $$ select false $$;
      create table public.dir_user_profiles(authenticated_id uuid primary key, role text);
      insert into public.dir_user_profiles values ('11111111-1111-4111-8111-111111111111', 'leader');
      create table public.packaging_movements(item_id bigint, movement_type text, qty_change integer, created_at timestamptz);
      insert into public.packaging_movements values
        (1, 'OUT', -4, now()), (1, 'OUT', -2, now() - interval '31 days'), (2, 'IN', 9, now());
    `)
    await db.exec(await readFile(new URL('../supabase/packaging_dashboard_leader_alerts.sql', import.meta.url), 'utf8'))
    const { rows } = await db.query('select * from public.packaging_outbound_30d()')
    assert.deepEqual(rows, [{ item_id: 1, out_qty: 4 }])
    await db.exec("update public.dir_user_profiles set role = 'storage_staff'")
    await assert.rejects(db.query('select * from public.packaging_outbound_30d()'), /Not allowed/)
  } finally {
    await db.close()
  }
})
