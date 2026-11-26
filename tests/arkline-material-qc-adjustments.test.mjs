import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const TASK_ID = '10000000-0000-0000-0000-000000000001'

test('Material QC adjustments keep inspector results and reject source overdraw', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$
        select '20000000-0000-0000-0000-000000000001'::uuid
      $$;
      create function public.reqc_has_permission(text) returns boolean language sql as $$ select true $$;
      create table public.arkline_material_qc (
        id uuid primary key, status text not null, qty_a integer not null,
        qty_b integer not null, qty_c integer not null,
        finished_at timestamptz, created_at timestamptz not null
      );
      insert into public.arkline_material_qc values
        ('${TASK_ID}', 'done', 10, 3, 2, '2026-11-24 08:00:00+00', '2026-11-23 08:00:00+00');
    `)

    const migration = await readFile(new URL('../supabase/arkline_material_qc_adjustments.sql', import.meta.url), 'utf8')
    await db.exec(migration)

    await db.query(`insert into public.arkline_material_qc_adjustments
      (arkline_material_qc_id, adjustment_type, from_grade, to_grade, qty, source_qc_date)
      values ($1, 'transfer', 'B', 'A', 2, '2000-01-01')`, [TASK_ID])
    await db.query(`insert into public.arkline_material_qc_adjustments
      (arkline_material_qc_id, adjustment_type, affected_grade, qty, source_qc_date)
      values ($1, 'inspector_data_error', 'C', 1, '2000-01-01')`, [TASK_ID])

    assert.deepEqual((await db.query(`select adjustment_type, qty, source_qc_date::text as source_qc_date
      from public.arkline_material_qc_adjustments order by id`)).rows, [
      { adjustment_type: 'transfer', qty: 2, source_qc_date: '2026-11-24' },
      { adjustment_type: 'inspector_data_error', qty: 1, source_qc_date: '2026-11-24' },
    ])
    assert.deepEqual((await db.query('select qty_a, qty_b, qty_c from public.arkline_material_qc')).rows,
      [{ qty_a: 10, qty_b: 3, qty_c: 2 }])

    await assert.rejects(db.query(`insert into public.arkline_material_qc_adjustments
      (arkline_material_qc_id, adjustment_type, from_grade, to_grade, qty, source_qc_date)
      values ($1, 'transfer', 'B', 'A', 2, '2026-11-24')`, [TASK_ID]), /exceeds available source grade/)

    await db.exec(`update public.arkline_material_qc set status = 'queued' where id = '${TASK_ID}'`)
    await assert.rejects(db.query(`insert into public.arkline_material_qc_adjustments
      (arkline_material_qc_id, adjustment_type, affected_grade, qty, source_qc_date)
      values ($1, 'inspector_data_error', 'A', 1, '2026-11-24')`, [TASK_ID]), /Only completed/)
  } finally {
    await db.close()
  }
})
