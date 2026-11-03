import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('Re-QC adjustment transfers pending qty without changing the inspected total', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create function reqc_has_permission(text) returns boolean language sql as $$ select true $$;
      create table qc_items (id bigint primary key, qc_type text, reqc_queue_id uuid, status text,
        qty_a integer, qty_b integer, qty_c integer, allocated_qty integer);
      create table reqc_queue (id uuid primary key, qty integer, status text, updated_at timestamptz);
      create table reqc_results (id uuid primary key default gen_random_uuid(), reqc_queue_id uuid not null,
        qc_item_id bigint not null references qc_items(id), grade text not null,
        qty integer not null check (qty > 0), status text not null default 'PENDING_REVIEW',
        updated_at timestamptz, unique (qc_item_id, grade));
      insert into reqc_queue values ('10000000-0000-0000-0000-000000000001', 10, 'QC_DONE', now());
      insert into qc_items values (1, 'RE_QC', '10000000-0000-0000-0000-000000000001', 'done', 0, 4, 6, 10);
      insert into reqc_results (id, reqc_queue_id, qc_item_id, grade, qty) values
        ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'B', 4),
        ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1, 'C', 6);
    `)
    const migration = await readFile(new URL('../supabase/regular_reqc_review_adjustment.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.query('select adjust_reqc_result($1::uuid, $2, $3, $4, $5)',
      ['20000000-0000-0000-0000-000000000001', 'A', 2, 'B to A', 'reviewer'])
    assert.deepEqual((await db.query('select grade, qty from reqc_results order by grade')).rows,
      [{ grade: 'A', qty: 2 }, { grade: 'B', qty: 2 }, { grade: 'C', qty: 6 }])
    await db.query('select adjust_reqc_result($1::uuid, $2, $3, $4, $5)',
      ['20000000-0000-0000-0000-000000000001', 'A', 2, 'rest of B', 'reviewer'])
    assert.deepEqual((await db.query('select grade, qty from reqc_results order by grade')).rows,
      [{ grade: 'A', qty: 4 }, { grade: 'C', qty: 6 }])
    assert.equal((await db.query('select sum(qty)::int as total from reqc_results')).rows[0].total, 10)
    assert.equal((await db.query('select count(*)::int as count from reqc_adjustments')).rows[0].count, 2)
    await db.query("update reqc_results set status = 'SHELVING_QUEUE' where grade = 'A'")
    await assert.rejects(db.query('select adjust_reqc_result($1::uuid, $2, $3, $4, $5)',
      ['20000000-0000-0000-0000-000000000002', 'A', 1, 'too late', 'reviewer']), /already been reviewed/)
    await assert.rejects(db.query('select adjust_reqc_result($1::uuid, $2, $3, $4, $5)',
      ['20000000-0000-0000-0000-000000000002', 'C', 1, 'same grade', 'reviewer']), /another grade/)
  } finally {
    await db.close()
  }
})
