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
    receivingQty: 80,
    intakeQty: 80,
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
