import { NextResponse } from 'next/server'

import { loadAccessContext } from '@/utils/access-control'
import { createClient } from '@/utils/supabase/server'

const SCAN_COLUMNS = ['is_packed', 'is_delivered', 'timestamp_packing', 'timestamp_delivery']

export async function DELETE(request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Please sign in to remove a barcode.' }, { status: 401 })
  }

  const access = await loadAccessContext(supabase, user, 'role')
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Only admins can remove missing barcodes.' }, { status: 403 })
  }

  const payload = await request.json().catch(() => ({}))
  const barcode = String(payload.barcode || '').trim()
  if (!barcode || barcode.length > 256) {
    return NextResponse.json({ error: 'A valid barcode is required.' }, { status: 400 })
  }

  const { data: row, error: lookupError } = await supabase
    .from('delivery_barcode')
    .select(`barcode,${SCAN_COLUMNS.join(',')}`)
    .eq('barcode', barcode)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: `Failed to check barcode: ${lookupError.message}` }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Barcode was not found. Refresh the summary.' }, { status: 404 })
  }

  const packed = Boolean(row.is_packed || row.timestamp_packing)
  const delivered = Boolean(row.is_delivered || row.timestamp_delivery)
  if (packed === delivered) {
    return NextResponse.json({ error: 'This barcode is no longer missing a scan. Refresh the summary.' }, { status: 409 })
  }

  // Keep the scan-state comparison in the DELETE so a concurrent scan cannot be removed.
  let deletion = supabase.from('delivery_barcode').delete().eq('barcode', barcode)
  for (const column of SCAN_COLUMNS) {
    deletion = row[column] == null ? deletion.is(column, null) : deletion.eq(column, row[column])
  }
  const { data: deletedRows, error: deleteError } = await deletion.select('barcode')

  if (deleteError?.code === '23503') {
    return NextResponse.json({ error: 'This barcode is linked to a return case and cannot be removed.' }, { status: 409 })
  }
  if (deleteError) {
    return NextResponse.json({ error: `Failed to remove barcode: ${deleteError.message}` }, { status: 500 })
  }
  if (deletedRows?.length !== 1) {
    return NextResponse.json({ error: 'The barcode changed before it could be removed. Refresh the summary.' }, { status: 409 })
  }

  return NextResponse.json({ barcode: deletedRows[0].barcode })
}
