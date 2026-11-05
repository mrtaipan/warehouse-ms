import assert from 'node:assert/strict'
import test from 'node:test'
import { writeFile } from 'node:fs/promises'

import { jsPDF } from 'jspdf'
import { buildMaterialInspectionDocument } from '../app/dashboard/arkline/progress-overview/print-material-inspection.js'

const inspection = {
  id: 'test-inspection', supplier_name: 'NIRWANA', material_name: 'QUALITY 01070/10/25 SUPER SOFT + ENZYME + ANTI PILLING; 100% COTTON INTERLOCK 200 GSM CUT WIDTH 72 INCHES',
  lot: '3568-08-26', nominal_width_in: 69, nominal_gsm: 270,
  inspected_at: '2026-09-25T02:00:00Z', inspected_by: 'Inspector',
  total_points: 48, scored_points: 40, points_per_100_sq_yd: 24, grade: 'B',
  remarks: 'Accepted with cutting conditions.',
}
const item = { poId: 'PO-19-29NRW07-2026', supplier: 'NIRWANA', productName: 'COTTON INTERLOCK', sku: 'OBSIDIAN BLACK' }
const groups = [
  { id: 'y', name: 'Yarn & Knit' }, { id: 'd', name: 'Dyeing' },
  { id: 'f', name: 'Finishing/Brushing' }, { id: 'p', name: 'Printing' },
]
const types = [{ group_id: 'd', code: 'D01', defect_name: 'Abration' }]
const rolls = Array.from({ length: 12 }, (_, index) => ({
  id: `roll-${index + 1}`, roll_no: `R-${String(index + 1).padStart(2, '0')}`,
  actual_yards: 43, actual_gsm: 283, actual_width_in: 71,
  total_points: 4, scored_points: 4, points_per_100_sq_yd: 5, grade: 'A',
  remarks: 'Accepted after cutting.',
}))
const defects = Array.from({ length: 14 }, (_, index) => ({
  roll_id: 'roll-1', defect_code: 'D01', position_yards: index + 1, points: 1,
}))

test('fabric inspection PDF uses landscape A4 and continues long roll lists', async () => {
  const doc = buildMaterialInspectionDocument(jsPDF, { inspection, item, rolls, groups, types, defects })
  assert.equal(Math.round(doc.internal.pageSize.getWidth()), 297)
  assert.equal(Math.round(doc.internal.pageSize.getHeight()), 210)
  assert.ok(doc.internal.getNumberOfPages() >= 2)
  assert.ok(doc.output('arraybuffer').byteLength > 1000)
  assert.match(doc.output(), /Total Pts: 48/)
  if (process.env.PREVIEW_PDF) await writeFile(process.env.PREVIEW_PDF, Buffer.from(doc.output('arraybuffer')))
})
