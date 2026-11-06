import assert from 'node:assert/strict'
import test from 'node:test'

import { PDFDocument } from 'pdf-lib'
import { appendPdfPages } from '../app/dashboard/arkline/progress-overview/cmt-inspection-pdf.js'

test('measurement PDF pages are appended after the CMT inspection pages', async () => {
  const report = await PDFDocument.create()
  report.addPage([595, 842])
  report.addPage([595, 842])

  const measurement = await PDFDocument.create()
  measurement.addPage([612, 792])

  const mergedBytes = await appendPdfPages(await report.save(), await measurement.save())
  const merged = await PDFDocument.load(mergedBytes)

  assert.equal(merged.getPageCount(), 3)
  assert.deepEqual(merged.getPage(2).getSize(), { width: 612, height: 792 })
})
