const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const MARGIN = 9
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const DEFECT_COLUMNS = 12
const ROLL_ROW_HEIGHT = 5
const ROLL_META_WIDTH = 48
const ROLL_RESULT_WIDTH = 69
const ROLL_METRIC_WIDTHS = [13, 18, 10, 28]

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
    const response = await fetch('/Gemini_Generated_Image_1pgskj1pgskj1pgs.png')
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
      doc.addImage(wordmark, 'PNG', left + 2, top + 0.5, 42, 17, undefined, 'FAST')
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
    ['Expected GSM', `${inspection.nominal_gsm} gsm`],
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

function drawRollTableHeader(doc, y) {
  const defectWidth = CONTENT_WIDTH - ROLL_META_WIDTH - ROLL_RESULT_WIDTH
  const defectX = MARGIN + ROLL_META_WIDTH
  const resultX = defectX + defectWidth
  drawCell(doc, 'ROLL NUMBER', MARGIN, y, ROLL_META_WIDTH, ROLL_ROW_HEIGHT, { bold: true, align: 'center', fill: true })
  drawCell(doc, 'DEFECT ASSESSMENT', defectX, y, defectWidth, ROLL_ROW_HEIGHT * 2, { bold: true, align: 'center', fill: true, middle: true })
  drawCell(doc, 'ROLL RESULT', resultX, y, ROLL_RESULT_WIDTH, ROLL_ROW_HEIGHT, { bold: true, align: 'center', fill: true })
  ;['Yard', 'GSM', 'Width (in)'].forEach((label, i) => drawCell(doc, label, MARGIN + i * ROLL_META_WIDTH / 3, y + ROLL_ROW_HEIGHT, ROLL_META_WIDTH / 3, ROLL_ROW_HEIGHT, { bold: true, align: 'center', fill: true }))
  let offset = 0
  ;['Total Pts', 'Pts/100 sq yd', 'Grade', 'Comment'].forEach((label, i) => {
    drawCell(doc, label, resultX + offset, y + ROLL_ROW_HEIGHT, ROLL_METRIC_WIDTHS[i], ROLL_ROW_HEIGHT, { bold: true, fill: true, size: 5.8, align: 'center', middle: true })
    offset += ROLL_METRIC_WIDTHS[i]
  })
  return y + ROLL_ROW_HEIGHT * 2
}

function drawRoll(doc, roll, defects, startY, partIndex = 0) {
  const rowHeight = ROLL_ROW_HEIGHT
  const metaWidth = ROLL_META_WIDTH
  const defectWidth = CONTENT_WIDTH - metaWidth - ROLL_RESULT_WIDTH
  const defectLabelWidth = 19
  const slotWidth = (defectWidth - defectLabelWidth) / DEFECT_COLUMNS
  const defectRows = defects.slice(partIndex * DEFECT_COLUMNS, (partIndex + 1) * DEFECT_COLUMNS)
  const x = MARGIN
  const y = startY

  const third = metaWidth / 3
  const defectX = x + metaWidth
  const resultX = defectX + defectWidth
  drawCell(doc, asText(roll.roll_no).replace(/^R-0*/, '') + (partIndex ? ' (cont.)' : ''), x, y, metaWidth, rowHeight * 2, { bold: true, align: 'center', middle: true })
  ;[roll.actual_yards, roll.actual_gsm, roll.actual_width_in].forEach((value, i) => drawCell(doc, value, x + i * third, y + rowHeight * 2, third, rowHeight, { align: 'center', middle: true }))

  ;['Defect', 'Position (yd)', 'Point'].forEach((label, rowIndex) => {
    const yy = y + rowHeight * rowIndex
    drawCell(doc, label, defectX, yy, defectLabelWidth, rowHeight, { bold: true, fill: true, size: 6.2 })
    defectRows.forEach((defect, colIndex) => {
      const value = rowIndex === 0 ? defect.defect_code : rowIndex === 1 ? defect.position_yards : defect.points
      drawCell(doc, value, defectX + defectLabelWidth + colIndex * slotWidth, yy, slotWidth, rowHeight, { align: 'center', size: 6 })
    })
    for (let col = defectRows.length; col < DEFECT_COLUMNS; col++) {
      drawCell(doc, '', defectX + defectLabelWidth + col * slotWidth, yy, slotWidth, rowHeight)
    }
  })

  const metricValues = [roll.total_points, roll.points_per_100_sq_yd, roll.grade, roll.remarks || '-']
  let offset = 0
  metricValues.forEach((value, i) => {
    const width = ROLL_METRIC_WIDTHS[i]
    drawCell(doc, value, resultX + offset, y, width, rowHeight * 3, { bold: true, size: 6.5, maxLines: 3, align: 'center', middle: true, danger: roll.grade === 'X' })
    offset += width
  })
  return y + rowHeight * 3
}

export function buildMaterialInspectionDocument(jsPDF, { inspection, item, rolls, groups, types, defects, wordmark = null }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const printedAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
  let page = 1
  let y = drawPageHeader(doc, inspection, item, groups || [], types || [], wordmark, page, printedAt)
  y = drawRollTableHeader(doc, y)
  const newPage = (withRollHeader = true) => {
    doc.addPage()
    page += 1
    y = drawPageHeader(doc, inspection, item, groups || [], types || [], wordmark, page, printedAt)
    if (withRollHeader) y = drawRollTableHeader(doc, y)
  }
  rolls.forEach((roll, rollIndex) => {
    const rollDefects = (defects || []).filter((defect) => defect.roll_id === roll.id)
    const parts = Math.max(1, Math.ceil(rollDefects.length / DEFECT_COLUMNS))
    for (let part = 0; part < parts; part++) {
      const drawSeparator = rollIndex > 0 && part === 0
      if (y + ROLL_ROW_HEIGHT * 3 > PAGE_HEIGHT - MARGIN) newPage()
      const rollTop = y
      y = drawRoll(doc, roll, rollDefects, y, part)
      if (drawSeparator) {
        doc.setDrawColor(55, 67, 84)
        doc.setLineWidth(0.5)
        doc.line(MARGIN, rollTop, MARGIN + CONTENT_WIDTH, rollTop)
        doc.setLineWidth(0.25)
      }
    }
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const conclusion = doc.splitTextToSize(`Conclusion: ${inspection.remarks || '-'}`, CONTENT_WIDTH - 8)
  const summaryHeight = 18 + conclusion.length * 3.5
  if (y + summaryHeight + 3 > PAGE_HEIGHT - MARGIN) newPage(false)
  y += 3
  doc.setFillColor(235, 241, 247)
  doc.setDrawColor(175, 185, 198)
  doc.rect(MARGIN, y, CONTENT_WIDTH, summaryHeight, 'FD')
  doc.setTextColor(20, 30, 48)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('INSPECTION SUMMARY', MARGIN + 4, y + 5)
  doc.setFontSize(7)
  doc.text(`Total Pts: ${inspection.total_points}`, MARGIN + 4, y + 11)
  doc.text(`Total Pts / 100 sq yd: ${inspection.points_per_100_sq_yd}`, MARGIN + 78, y + 11)
  doc.text(`Grade ${inspection.grade}`, MARGIN + 143, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(conclusion, MARGIN + 4, y + 17)
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
