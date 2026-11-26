import test from 'node:test'
import assert from 'node:assert/strict'
import { jsPDF } from 'jspdf'
import { drawInboundReportPdf, inboundReportPdfFilename } from '../utils/inbound-report-pdf.mjs'

function report(overrides = {}) {
  return {
    grnNumber: '#035-XI2026',
    supplierName: 'Supplier A',
    itemName: 'SHIRT AND HOODIE',
    sjQty: null,
    intakeQty: 80,
    inboundReturnQty: 7,
    returnReasons: [{ reason: 'Damaged packaging', qty: 7 }],
    sampleQcRows: [
      { brandName: 'Old Navy', categoryName: 'Top Wear > Shirt > Long Sleeve', a: 22, b: 0, c: 28 },
      { brandName: 'Amazon Essentials', categoryName: 'Top Wear > Outer > Hoodie Fullzipper', a: 14, b: 0, c: 16 },
    ],
    modelRows: [
      { brandName: 'Old Navy', categoryLabel: 'Top Wear > Shirt > Long Sleeve', modelLabel: 'SHIRT - BLUE', modelQty: 50 },
    ],
    shownQty: 50,
    ...overrides,
  }
}

test('PDF keeps Sample QC above Model Summary and calculates percentages per product', () => {
  const doc = drawInboundReportPdf(new jsPDF({ unit: 'mm', format: 'a4' }), report())
  const operations = doc.internal.pages.flat().join('\n')

  assert.ok(operations.indexOf('Sample QC Results') < operations.indexOf('Model Summary'))
  assert.match(operations, /22 .*44%/)
  assert.match(operations, /28 .*56%/)
  assert.match(operations, /14 .*46\.7%/)
  assert.match(operations, /16 .*53\.3%/)
  assert.match(operations, /No data/)
  assert.equal(doc.getNumberOfPages(), 1)
})

test('PDF shows four totals and inbound return reasons in the requested order', () => {
  const doc = drawInboundReportPdf(new jsPDF({ unit: 'mm', format: 'a4' }), report({ sjQty: 100 }))
  const operations = doc.internal.pages.flat().join('\n')
  const labels = ['TOTAL SJ QTY', 'TOTAL INTAKE QTY', 'TOTAL INBOUND RETUR QTY', 'TOTAL RECEIVING QTY']
  const positions = labels.map((label) => operations.indexOf(label))

  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
  assert.match(operations, /\(87\) Tj/)
  assert.ok(operations.indexOf('Inbound Return Reasons') < operations.indexOf('Sample QC Results'))
  assert.match(operations, /Damaged packaging/)
})

test('long inbound return reasons paginate without losing the model summary', () => {
  const returnReasons = Array.from({ length: 55 }, (_, index) => ({
    reason: `Return reason ${index + 1} with a long explanation for the incoming goods`, qty: index + 1,
  }))
  const doc = drawInboundReportPdf(new jsPDF({ unit: 'mm', format: 'a4' }), report({ returnReasons }))
  const operations = doc.internal.pages.flat().join('\n')

  assert.ok(doc.getNumberOfPages() > 1)
  assert.match(operations, /Return reason 55/)
  assert.match(operations, /Model Summary/)
})

test('long model summaries create additional pages with page numbers', () => {
  const modelRows = Array.from({ length: 45 }, (_, index) => ({
    brandName: 'Old Navy',
    categoryLabel: 'Top Wear > Shirt > Long Sleeve',
    modelLabel: `LONG SLEEVE SHIRT - VARIANT ${index + 1}`,
    modelQty: index + 1,
  }))
  const doc = drawInboundReportPdf(new jsPDF({ unit: 'mm', format: 'a4' }), report({ modelRows, shownQty: 1035 }))

  assert.ok(doc.getNumberOfPages() > 1)
  doc.internal.pages.slice(1).forEach((page, index) => {
    assert.match(page.join('\n'), new RegExp(`Page ${index + 1} of ${doc.getNumberOfPages()}`))
  })
})

test('PDF filename uses the selected GRN and removes invalid filename characters', () => {
  assert.equal(inboundReportPdfFilename('#035-XI2026'), 'Inbound Report - #035-XI2026.pdf')
  assert.equal(inboundReportPdfFilename('GRN/35:2026'), 'Inbound Report - GRN-35-2026.pdf')
})

test('section titles sit directly above their tables without heading rules', () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const calls = []
  for (const method of ['text', 'rect', 'line']) {
    const original = doc[method].bind(doc)
    doc[method] = (...args) => {
      calls.push({ method, args })
      return original(...args)
    }
  }
  drawInboundReportPdf(doc, report())

  for (const title of ['Sample QC Results', 'Model Summary']) {
    const titleIndex = calls.findIndex((call) => call.method === 'text' && call.args[0] === title)
    const titleY = calls[titleIndex].args[2]
    const header = calls.slice(titleIndex + 1).find((call) => call.method === 'rect')
    assert.ok(header.args[1] - titleY <= 1.01, `${title} must stay attached to its table`)
    assert.ok(!calls.some((call) => call.method === 'line' &&
      call.args[1] >= titleY && call.args[1] <= header.args[1] + header.args[3]),
    `${title} must not have a title or table-heading underline`)
  }
})
