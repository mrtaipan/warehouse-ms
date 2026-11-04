import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('bulk Re-QC review preserves source groups and stores rejects in one koli', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create function reqc_has_permission(text) returns boolean language sql as $$ select true $$;
      create table reqc_queue (id uuid primary key, group_code text);
      create table reqc_results (
        id uuid primary key, reqc_queue_id uuid not null references reqc_queue(id),
        grade text not null, qty integer not null, status text not null default 'PENDING_REVIEW',
        updated_at timestamptz
      );
      create table warehouse_shelving_queue (
        id bigint generated always as identity primary key,
        reqc_result_id uuid, group_code text, status text not null,
        stored_at timestamptz, target_rack_location_id bigint, notes text
      );
      create table warehouse_reject_storage (
        id bigint generated always as identity primary key,
        reqc_result_id uuid, koli_number text, reject_note text
      );
      create function confirm_reqc_grade_a_to_shelving(p_id uuid, p_by text)
      returns bigint language plpgsql as $$
      declare v_id bigint;
      begin
        if not exists (select 1 from public.reqc_results where id = p_id and grade = 'A' and status = 'PENDING_REVIEW') then
          raise exception 'Grade A result is not pending';
        end if;
        insert into public.warehouse_shelving_queue(reqc_result_id, group_code, status)
        select r.id, q.group_code, 'WAITING_SHELVING'
        from public.reqc_results r join public.reqc_queue q on q.id = r.reqc_queue_id where r.id = p_id
        returning id into v_id;
        update public.reqc_results set status = 'SHELVING_QUEUE' where id = p_id;
        return v_id;
      end;
      $$;
      create function confirm_reqc_grade_a_to_storage(p_id uuid, p_by text)
      returns uuid language plpgsql as $$
      begin
        if not exists (select 1 from public.reqc_results where id = p_id and grade = 'A' and status = 'PENDING_REVIEW') then
          raise exception 'Grade A result is not pending';
        end if;
        update public.reqc_results set status = 'STORAGE_QUEUE' where id = p_id;
        return p_id;
      end;
      $$;
      create function confirm_reqc_reject_to_storage_with_note(p_id uuid, p_koli text, p_note text, p_by text)
      returns bigint language plpgsql as $$
      declare v_id bigint;
      begin
        if not exists (select 1 from public.reqc_results where id = p_id and grade in ('B', 'C') and status = 'PENDING_REVIEW') then
          raise exception 'Reject result is not pending';
        end if;
        insert into public.warehouse_reject_storage(reqc_result_id, koli_number, reject_note)
        values (p_id, coalesce(p_koli, 'R-001'), p_note) returning id into v_id;
        update public.reqc_results set status = 'REJECTION_STORAGE' where id = p_id;
        return v_id;
      end;
      $$;
      insert into reqc_queue values
        ('10000000-0000-0000-0000-000000000001', 'MOB'),
        ('10000000-0000-0000-0000-000000000002', 'OI');
      insert into reqc_results(id, reqc_queue_id, grade, qty) values
        ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A', 2),
        ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'A', 3),
        ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'B', 1),
        ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'C', 4);
    `)
    const migration = await readFile(new URL('../supabase/regular_reqc_bulk_review_to_shelving.sql', import.meta.url), 'utf8')
    await db.exec(migration)

    const aIds = ['20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002']
    const rejectIds = ['20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004']
    await assert.rejects(
      db.query('select review_reqc_results($1::uuid[], $2, $3, $4, $5)', [[aIds[0], aIds[0]], 'CONFIRM_A', null, null, 'reviewer']),
      /Duplicate results/
    )
    const confirmed = await db.query('select review_reqc_results($1::uuid[], $2, $3, $4, $5) as count', [aIds, 'CONFIRM_A', null, null, 'reviewer'])
    assert.equal(confirmed.rows[0].count, 2)
    assert.deepEqual(
      (await db.query('select group_code from warehouse_shelving_queue order by reqc_result_id')).rows.map((row) => row.group_code),
      ['MOB', 'OI']
    )
    await db.query("update warehouse_shelving_queue set status = 'STORED' where group_code = 'MOB'")
    assert.equal((await db.query('select status from reqc_results where id = $1', [aIds[0]])).rows[0].status, 'STORED')
    assert.equal((await db.query('select status from reqc_results where id = $1', [aIds[1]])).rows[0].status, 'SHELVING_QUEUE')

    const storageQueueMigration = await readFile(new URL('../supabase/regular_reqc_confirm_a_storage_queue.sql', import.meta.url), 'utf8')
    await db.exec(storageQueueMigration)
    assert.equal((await db.query('select status from reqc_results where id = $1', [aIds[0]])).rows[0].status, 'STORED')
    assert.equal((await db.query('select status from reqc_results where id = $1', [aIds[1]])).rows[0].status, 'STORAGE_QUEUE')
    assert.deepEqual((await db.query('select group_code, status from warehouse_shelving_queue order by reqc_result_id')).rows,
      [{ group_code: 'MOB', status: 'STORED' }, { group_code: 'OI', status: 'CANCELLED' }])

    await db.exec(`insert into reqc_results(id, reqc_queue_id, grade, qty)
      values ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'A', 1)`)
    await db.query('select review_reqc_results($1::uuid[], $2, $3, $4, $5)',
      [['20000000-0000-0000-0000-000000000005'], 'CONFIRM_A', null, null, 'reviewer'])
    assert.equal((await db.query("select status from reqc_results where id = '20000000-0000-0000-0000-000000000005'")).rows[0].status, 'STORAGE_QUEUE')
    assert.equal((await db.query('select count(*)::int as count from warehouse_shelving_queue')).rows[0].count, 2)

    const stored = await db.query('select review_reqc_results($1::uuid[], $2, $3, $4, $5) as count', [rejectIds, 'STORE_REJECT', null, 'QC reject', 'reviewer'])
    assert.equal(stored.rows[0].count, 2)
    assert.deepEqual(
      (await db.query('select koli_number from warehouse_reject_storage order by reqc_result_id')).rows.map((row) => row.koli_number),
      ['R-001', 'R-001']
    )
  } finally {
    await db.close()
  }
})
