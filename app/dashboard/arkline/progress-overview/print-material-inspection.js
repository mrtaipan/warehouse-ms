const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const MARGIN = 9
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const DEFECT_COLUMNS = 12

function asText(value, fallback = '-') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function drawText(doc, value, x, y, width, options = {}) {
  const lines = doc.splitTextToSize(asText(value), width)
  doc.text(lines.slice(0, options.maxLines || 2), x, y, options.align ? { align: options.align } : undefined)
}

function drawCell(doc, value, x, y, width, height, options = {}) {
  doc.setDrawColor(175, 185, 198)
  if (options.fill) doc.setFillColor(235, 241, 247)
  doc.rect(x, y, width, height, options.fill ? 'FD' : 'S')
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal')
  doc.setFontSize(options.size || 7)
  doc.setTextColor(options.danger ? 180 : 20, options.danger ? 40 : 30, options.danger ? 40 : 48)
  const lines = doc.splitTextToSize(asText(value, ''), width - 3).slice(0, options.maxLines || 2)
  const textY = options.middle ? y + height / 2 - (lines.length - 1) * 1.3 + 1.1 : y + Math.min(height / 2 + 1.8, 4)
  doc.text(lines, options.align === 'center' ? x + width / 2 : x + 1.5, textY, { align: options.align || 'left' })
  doc.setTextColor(20, 30, 48)
}

async function loadWordmark() {
  try {
    const response = await fetch('/arkline-wordmark-transparent.png')
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawPageHeader(doc, inspection, item, groups, defects, wordmark, pageNumber, printedAt) {
  const left = MARGIN
  const top = MARGIN
  const leftWidth = 132
  const centerWidth = 98
  const rightWidth = CONTENT_WIDTH - leftWidth - centerWidth
  const titleHeight = 18
  doc.setDrawColor(130, 145, 165)
  doc.setLineWidth(0.25)
  doc.rect(left, top, CONTENT_WIDTH, titleHeight)
  let wordmarkDrawn = false
  if (wordmark) {
    try {
      doc.addImage(wordmark, 'PNG', left + 3, top + 3.5, 31, 10.6, undefined, 'FAST')
      wordmarkDrawn = true
    } catch { /* Use the text fallback below. */ }
  }
  if (!wordmarkDrawn) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('ARKLINE', left + 4, top + 11)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('FABRIC INSPECTION RESULT', left + CONTENT_WIDTH / 2, top + 7, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(asText(item.poId), left + CONTENT_WIDTH / 2, top + 12.5, { align: 'center' })
  doc.text(`Page ${pageNumber}`, left + CONTENT_WIDTH - 3, top + 12, { align: 'right' })
  doc.setFontSize(5.8)
  doc.text(`Printed on ${printedAt}`, left + CONTENT_WIDTH - 3, top + 15.5, { align: 'right' })

  const blockY = top + titleHeight
  const blockHeight = 42 * Math.max(1, Math.ceil(groups.length / 4))
  doc.rect(left, blockY, leftWidth, blockHeight)
  doc.rect(left + leftWidth, blockY, centerWidth, blockHeight)
  doc.rect(left + leftWidth + centerWidth, blockY, rightWidth, blockHeight)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('FABRIC DEFECT CLASSIFICATION', left + 2, blockY + 5)
  groups.forEach((group, groupIndex) => {
    const colWidth = (leftWidth - 4) / 4
    const gx = left + 2 + (groupIndex % 4) * colWidth
    const groupY = blockY + Math.floor(groupIndex / 4) * 42
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.text(doc.splitTextToSize(group.name, colWidth - 2).slice(0, 1), gx, groupY + 10)
    doc.setFont('helvetica', 'normal')
    defects.filter((defect) => defect.group_id === group.id).slice(0, 6).forEach((defect, i) => {
      drawText(doc, `${defect.code} ${defect.defect_name}`, gx, groupY + 14 + i * 3.3, colWidth - 2, { maxLines: 1 })
    })
  })

  const infoX = left + leftWidth + 2
  const infoRows = [
    ['Supplier', inspection.supplier_name || item.supplier],
    ['Material', inspection.material_name || item.productName],
    ['Lot', inspection.lot],
    ['Expected Width', `${inspection.nominal_width_in} in`],
    ['Expected Gramasi', `${inspection.nominal_gsm} gsm`],
    ['Inspection Date', new Date(inspection.inspected_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' })],
    ['Inspected By', inspection.inspected_by],
  ]
  doc.setFontSize(6.5)
  let infoY = blockY + 4
  infoRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, infoX, infoY)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(asText(value), centerWidth - 29).slice(0, label === 'Material' ? 3 : 1)
    doc.text(lines, infoX + 25, infoY)
    infoY += Math.max(1, lines.length) * 3.1 + 1.3
  })

  const stdX = left + leftWidth + centerWidth + 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('STANDARD 4 POINT SYSTEM', stdX, blockY + 5)
  const grades = [['<20', 'Grade A'], ['20-29', 'Grade B'], ['30-40', 'Grade C'], ['>40', 'Grade X']]
  doc.setFontSize(6.5)
  grades.forEach(([range, grade], i) => {
    doc.setFont('helvetica', 'normal')
    doc.text(`${range} points / 100 sq yd`, stdX, blockY + 10 + i * 5)
    doc.setFont('helvetica', 'bold')
    doc.text(grade, stdX + rightWidth - 6, blockY + 10 + i * 5, { align: 'right' })
  })
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text('Scores are rounded up.', stdX, blockY + 31)
  return blockY + blockHeight + 5
}

function drawRoll(doc, roll, defects, startY, partIndex = 0) {
  const rowHeight = 5
  const metaWidth = 48
  const resultWidth = 69
  const defectWidth = CONTENT_WIDTH - metaWidth - resultWidth
  const defectLabelWidth = 19
  const slotWidth = (defectWidth - defectLabelWidth) / DEFECT_COLUMNS
  const defectRows = defects.slice(partIndex * DEFECT_COLUMNS, (partIndex + 1) * DEFECT_COLUMNS)
  const x = MARGIN
  const y = startY

  const third = metaWidth / 3
  const defectX = x + metaWidth
  const resultX = defectX + defectWidth
  drawCell(doc, 'ROLL NUMBER', x, y, metaWidth, rowHeight, { bold: true, align: 'center', fill: true })
  drawCell(doc, 'DEFECT ASSESSMENT', defectX, y, defectWidth, rowHeight * 2, { bold: true, align: 'center', fill: true, middle: true })
  drawCell(doc, 'ROLL RESULT', resultX, y, resultWidth, rowHeight, { bold: true, align: 'center', fill: true })
  ;['Yard', 'GSM', 'Width (in)'].forEach((label, i) => drawCell(doc, label, x + i * third, y + rowHeight, third, rowHeight, { bold: true, align: 'center', fill: true }))
  drawCell(doc, asText(roll.roll_no).replace(/^R-0*/, '') + (partIndex ? ' (cont.)' : ''), x, y + rowHeight * 2, metaWidth, rowHeight * 2, { bold: true, align: 'center', middle: true })
  ;[roll.actual_yards, roll.actual_gsm, roll.actual_width_in].forEach((value, i) => drawCell(doc, value, x + i * third, y + rowHeight * 4, third, rowHeight, { align: 'center', middle: true }))

  ;['Defect', 'Position (yd)', 'Point'].forEach((label, rowIndex) => {
    const yy = y + rowHeight * (rowIndex + 2)
    drawCell(doc, label, defectX, yy, defectLabelWidth, rowHeight, { bold: true, fill: true, size: 6.2 })
    defectRows.forEach((defect, colIndex) => {
      const value = rowIndex === 0 ? defect.defect_code : rowIndex === 1 ? defect.position_yards : defect.points
      drawCell(doc, value, defectX + defectLabelWidth + colIndex * slotWidth, yy, slotWidth, rowHeight, { align: 'center', size: 6 })
    })
    for (let col = defectRows.length; col < DEFECT_COLUMNS; col++) {
      drawCell(doc, '', defectX + defectLabelWidth + col * slotWidth, yy, slotWidth, rowHeight)
    }
  })

  const metricWidths = [13, 18, 10, 28]
  const metricValues = [
    [roll.total_points, 'Total Pts'],
    [roll.points_per_100_sq_yd, 'Pts/100 sq yd'],
    [roll.grade, 'Grade'],
    [roll.remarks || '-', 'Comment'],
  ]
  let offset = 0
  metricValues.forEach(([value, label], i) => {
    const width = metricWidths[i]
    drawCell(doc, label, resultX + offset, y + rowHeight, width, rowHeight, { bold: true, fill: true, size: 5.8, align: 'center', middle: true })
    drawCell(doc, value, resultX + offset, y + rowHeight * 2, width, rowHeight * 3, { bold: true, size: 6.5, maxLines: 3, align: 'center', middle: true, danger: roll.grade === 'X' })
    offset += width
  })
  return y + rowHeight * 5 + 3
}

export function buildMaterialInspectionDocument(jsPDF, { inspection, item, rolls, groups, types, defects, wordmark = null }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const printedAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
  let page = 1
  let y = drawPageHeader(doc, inspection, item, groups || [], types || [], wordmark, page, printedAt)
  const newPage = () => {
    doc.addPage()
    page += 1
    y = drawPageHeader(doc, inspection, item, groups || [], types || [], wordmark, page, printedAt)
  }
  rolls.forEach((roll) => {
    const rollDefects = (defects || []).filter((defect) => defect.roll_id === roll.id)
    const parts = Math.max(1, Math.ceil(rollDefects.length / DEFECT_COLUMNS))
    for (let part = 0; part < parts; part++) {
      if (y + 29 > PAGE_HEIGHT - MARGIN) newPage()
      y = drawRoll(doc, roll, rollDefects, y, part)
    }
  })
  if (y + 15 > PAGE_HEIGHT - MARGIN) newPage()
  drawCell(doc, 'INSPECTION SUMMARY', MARGIN, y, CONTENT_WIDTH, 6, { bold: true })
  y += 6
  drawCell(doc, `Total Pts: ${inspection.total_points}`, MARGIN, y, 74, 7, { bold: true })
  drawCell(doc, `Total Pts / 100 sq yd: ${inspection.points_per_100_sq_yd}`, MARGIN + 74, y, 65, 7, { bold: true })
  drawCell(doc, `Grade ${inspection.grade}`, MARGIN + 139, y, 34, 7, { bold: true, danger: inspection.grade === 'X' })
  drawCell(doc, `Conclusion: ${inspection.remarks || '-'}`, MARGIN + 173, y, CONTENT_WIDTH - 173, 7, { maxLines: 1 })
  return doc
}

export async function printMaterialInspectionPdf(inspection, item) {
  const { createClient } = await import('@/utils/supabase/browser')
  const supabase = createClient()
  const [{ data: rolls, error: rollError }, { data: groups, error: groupError }, { data: types, error: typeError }] = await Promise.all([
    supabase.from('arkline_cmt_material_rolls').select('id, roll_no, actual_yards, actual_gsm, actual_width_in, total_points, scored_points, points_per_100_sq_yd, grade, remarks, created_at').eq('inspection_id', inspection.id).order('created_at'),
    supabase.from('arkline_cmt_fabric_defect_groups').select('id, name, sort_order').order('sort_order'),
    supabase.from('arkline_cmt_fabric_defects').select('id, group_id, code, defect_name').order('code'),
  ])
  if (rollError || groupError || typeError) throw new Error(rollError?.message || groupError?.message || typeError?.message)
  if (!rolls?.length) throw new Error('No saved rolls found for this inspection.')
  const rollIds = rolls.map((roll) => roll.id)
  const { data: defects, error: defectError } = await supabase.from('arkline_cmt_material_roll_defects')
    .select('roll_id, defect_code, defect_name, position_yards, points, created_at')
    .in('roll_id', rollIds).order('created_at')
  if (defectError) throw new Error(defectError.message)

  const { jsPDF } = await import('jspdf')
  const wordmark = await loadWordmark()
  const doc = buildMaterialInspectionDocument(jsPDF, { inspection, item, rolls, groups, types, defects, wordmark })
  const safePo = asText(item.poId).replace(/[^a-z0-9-]/gi, '-')
  doc.save(`fabric-inspection-${safePo}-${inspection.id.slice(0, 8)}.pdf`)
}
