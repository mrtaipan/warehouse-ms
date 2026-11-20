import { sampleQcGradePercentage } from './inbound-sample-qc-report.mjs'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BOTTOM = PAGE_HEIGHT - 18
const INK = [18, 31, 54]
const MUTED = [96, 111, 133]
const BORDER = [213, 220, 229]
const PALE = [246, 248, 251]

function formatQty(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function text(value) {
  const result = String(value ?? '').trim()
  return result || '-'
}

export function inboundReportPdfFilename(grnNumber) {
  const grn = text(grnNumber).replace(/[\\/:*?"<>|]/g, '-').replace(/[. ]+$/g, '')
  return `Inbound Report - ${grn}.pdf`
}

async function readDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read PDF asset.'))
    reader.readAsDataURL(blob)
  })
}

async function registerFonts(doc) {
  const fonts = await Promise.all([
    fetch('/fonts/open-sans/OpenSans-Regular.ttf'),
    fetch('/fonts/open-sans/OpenSans-SemiBold.ttf'),
  ])
  if (fonts.some((response) => !response.ok)) throw new Error('Could not load PDF font.')
  const [regular, semibold] = await Promise.all(fonts.map(async (response) => readDataUrl(await response.blob())))
  doc.addFileToVFS('OpenSans-Regular.ttf', regular.split(',')[1])
  doc.addFileToVFS('OpenSans-SemiBold.ttf', semibold.split(',')[1])
  doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal')
  doc.addFont('OpenSans-SemiBold.ttf', 'OpenSans', 'bold')
}

async function imageDataUrl(url) {
  if (!url) return ''
  try {
    const response = await fetch(url)
    if (!response.ok) return ''
    const blob = await response.blob()
    const originalDataUrl = await readDataUrl(blob)
    try {
      const bitmap = await createImageBitmap(blob)
      const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      return canvas.toDataURL('image/jpeg', 0.84)
    } catch {
      return originalDataUrl
    }
  } catch {
    return ''
  }
}

export function drawInboundReportPdf(doc, report, photos = new Map(), font = 'helvetica') {
  const setFont = (size, weight = 'normal', color = INK) => {
    doc.setFont(font, weight)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  const linesOf = (value, width, size = 8) => {
    setFont(size)
    return doc.splitTextToSize(text(value), Math.max(1, width))
  }
  const rule = (fromX, atY, toX, color = BORDER, weight = 0.25) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(weight)
    doc.line(fromX, atY, toX, atY)
  }
  let y = MARGIN
  let page = 1

  const nextPage = () => {
    doc.addPage()
    page += 1
    y = MARGIN
    setFont(9, 'bold')
    doc.text('INBOUND REPORT', MARGIN, y + 3)
    setFont(8, 'normal', MUTED)
    doc.text(text(report.grnNumber), PAGE_WIDTH - MARGIN, y + 3, { align: 'right' })
    rule(MARGIN, y + 6, PAGE_WIDTH - MARGIN)
    y += 12
  }
  const ensureSpace = (height) => {
    if (y + height > BOTTOM) nextPage()
  }
  const sectionTitle = (label, firstRowHeight) => {
    ensureSpace(15 + 10 + firstRowHeight)
    y += 9
    setFont(12, 'bold')
    doc.text(label, MARGIN, y)
    y += 6
  }

  setFont(20, 'bold')
  doc.text('Inbound Report', MARGIN, y + 6)
  y += 12
  rule(MARGIN, y, PAGE_WIDTH - MARGIN, INK, 0.5)
  y += 8

  const metaLabel = (label, x) => {
    setFont(7, 'bold', MUTED)
    doc.text(label.toUpperCase(), x, y)
  }
  metaLabel('GRN Number', MARGIN)
  metaLabel('Supplier', MARGIN + 66)
  y += 5
  const supplierLines = linesOf(report.supplierName, CONTENT_WIDTH - 70, 9)
  setFont(9, 'bold')
  doc.text(text(report.grnNumber), MARGIN, y)
  doc.text(supplierLines, MARGIN + 66, y)
  y += Math.max(1, supplierLines.length) * 4.2 + 4
  metaLabel('Item Name', MARGIN)
  y += 5
  const itemLines = linesOf(report.itemName, CONTENT_WIDTH - 2, 9)
  setFont(9)
  doc.text(itemLines, MARGIN, y)
  y += itemLines.length * 4.2 + 8

  const cards = [
    ['Total SJ Qty', report.sjQty == null ? 'No data' : formatQty(report.sjQty)],
    ['Total Receiving Qty', formatQty(report.receivingQty)],
    ['Total Intake Qty', formatQty(report.intakeQty)],
  ]
  const cardGap = 3
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3
  cards.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardWidth + cardGap)
    doc.setFillColor(...PALE)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(x, y, cardWidth, 20, 1.5, 1.5, 'FD')
    setFont(6.8, 'bold', MUTED)
    doc.text(label.toUpperCase(), x + 4, y + 6)
    setFont(value === 'No data' ? 11 : 16, 'bold')
    doc.text(value, x + 4, y + 15)
  })
  y += 20

  const drawTable = ({ columns, rows, emptyText, minHeight = 11, photoColumn = -1 }) => {
    const drawHeading = () => {
      doc.setFillColor(...PALE)
      doc.rect(MARGIN, y, CONTENT_WIDTH, 10, 'F')
      let x = MARGIN
      columns.forEach((column) => {
        setFont(7.5, 'bold')
        doc.text(column.label, column.align === 'right' ? x + column.width - 2.5 : x + 2.5, y + 6.5,
          column.align === 'right' ? { align: 'right' } : undefined)
        x += column.width
      })
      rule(MARGIN, y + 10, PAGE_WIDTH - MARGIN, INK, 0.5)
      y += 10
    }
    const drawRow = (row, isTotal = false) => {
      const cellLines = columns.map((column, index) => index === photoColumn
        ? [] : linesOf(row[column.key], column.width - 5, isTotal ? 8 : 7.6))
      const rowHeight = Math.max(isTotal ? 11 : minHeight, ...cellLines.map((lines) => lines.length * 3.6 + 6))
      if (y + rowHeight > BOTTOM) {
        nextPage()
        drawHeading()
      }
      if (isTotal) {
        doc.setFillColor(...PALE)
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F')
      }
      rule(MARGIN, y + rowHeight, PAGE_WIDTH - MARGIN, isTotal ? INK : BORDER, isTotal ? 0.5 : 0.2)
      let x = MARGIN
      columns.forEach((column, index) => {
        if (index === photoColumn) {
          const image = photos.get(row.photoUrl)
          let photoDrawn = false
          if (image) {
            try {
              const props = doc.getImageProperties(image)
              const ratio = Math.min(16 / props.width, 16 / props.height)
              const width = props.width * ratio
              const height = props.height * ratio
              const format = image.startsWith('data:image/png') ? 'PNG' : image.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'
              doc.addImage(image, format, x + (column.width - width) / 2, y + (rowHeight - height) / 2, width, height)
              photoDrawn = true
            } catch {
              // A missing or invalid photo does not prevent the report from downloading.
            }
          }
          if (!photoDrawn && !isTotal) {
            setFont(6, 'normal', MUTED)
            doc.text('No photo', x + column.width / 2, y + rowHeight / 2 + 1, { align: 'center' })
          }
        } else if (row[column.key] != null) {
          setFont(isTotal ? 8 : 7.6, isTotal ? 'bold' : 'normal')
          const align = column.align === 'right' ? { align: 'right' } : undefined
          const cellX = column.align === 'right' ? x + column.width - 2.5 : x + 2.5
          doc.text(cellLines[index], cellX, y + 5.7, align)
        }
        x += column.width
      })
      y += rowHeight
    }

    ensureSpace(10 + minHeight)
    drawHeading()
    if (rows.length) rows.forEach((row) => drawRow(row, Boolean(row.isTotal)))
    else drawRow({ [columns[0].key]: emptyText })
  }

  if (report.sampleQcRows.length) {
    sectionTitle('Sample QC Results', 12)
    const grade = (qty, row) => `${formatQty(qty)} (${formatQty(sampleQcGradePercentage(qty, row))}%)`
    const qcRows = report.sampleQcRows.map((row) => ({
      product: `${text(row.brandName)} / ${text(row.categoryName)}`,
      a: grade(row.a, row),
      b: grade(row.b, row),
      c: grade(row.c, row),
    }))
    const totals = report.sampleQcRows.reduce((sum, row) => ({
      a: sum.a + Number(row.a || 0), b: sum.b + Number(row.b || 0), c: sum.c + Number(row.c || 0),
    }), { a: 0, b: 0, c: 0 })
    qcRows.push({ product: 'Total', a: grade(totals.a, totals), b: grade(totals.b, totals), c: grade(totals.c, totals), isTotal: true })
    drawTable({
      columns: [
        { key: 'product', label: 'Product', width: 101 },
        { key: 'a', label: 'Grade A', width: 27, align: 'right' },
        { key: 'b', label: 'Grade B', width: 27, align: 'right' },
        { key: 'c', label: 'Grade C', width: 27, align: 'right' },
      ],
      rows: qcRows,
      minHeight: 12,
    })
  }

  sectionTitle('Model Summary', 21)
  const modelRows = report.modelRows.map((row) => ({
    photoUrl: row.photoUrl,
    brandName: text(row.brandName),
    categoryLabel: text(row.categoryLabel),
    modelLabel: text(row.modelLabel),
    modelQty: formatQty(row.modelQty),
  }))
  modelRows.push({ brandName: 'Shown Qty', modelQty: formatQty(report.shownQty), isTotal: true })
  drawTable({
    columns: [
      { key: 'photoUrl', label: 'Photo', width: 22 },
      { key: 'brandName', label: 'Brand Name', width: 28 },
      { key: 'categoryLabel', label: 'Categories', width: 45 },
      { key: 'modelLabel', label: 'Model - Variant', width: 68 },
      { key: 'modelQty', label: 'Qty', width: 19, align: 'right' },
    ],
    rows: modelRows,
    minHeight: 21,
    photoColumn: 0,
  })

  for (let index = 1; index <= page; index += 1) {
    doc.setPage(index)
    rule(MARGIN, PAGE_HEIGHT - 14, PAGE_WIDTH - MARGIN)
    setFont(7, 'normal', MUTED)
    doc.text(text(report.grnNumber), MARGIN, PAGE_HEIGHT - 9)
    doc.text(`Page ${index} of ${page}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, { align: 'right' })
  }
  return doc
}

export async function createInboundReportPdf(report) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await registerFonts(doc)
  const photoUrls = [...new Set(report.modelRows.map((row) => row.photoUrl).filter(Boolean))]
  const photos = new Map(await Promise.all(photoUrls.map(async (url) => [url, await imageDataUrl(url)])))
  drawInboundReportPdf(doc, report, photos, 'OpenSans')
  return { doc, filename: inboundReportPdfFilename(report.grnNumber) }
}
