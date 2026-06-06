import fs from 'node:fs'
import path from 'node:path'
import { jsPDF } from 'jspdf'

const outputDir = path.join(process.cwd(), 'docs')
const outputFile = path.join(outputDir, 'user-role-access-matrix.pdf')

const topLevelRows = [
  ['admin', 'Yes', 'All', 'All', 'All', 'Yes', 'Yes', 'Yes', 'Yes', 'Full access by code + admin email override.'],
  ['hrga', 'Yes', 'DB-driven', 'No seed', 'Overview, Directory, BOM, Progress, Production Planning, Finance', 'Yes', 'No', 'No', 'No', 'Arkline access seeded in repo; HRGA access explicit in code.'],
  ['hrga_approver', 'Yes', 'DB-driven', 'No seed', 'No seed', 'Yes', 'No', 'No', 'No', 'HRGA access explicit in code. No Arkline seed found in repo.'],
  ['qc_staff', 'Yes', 'DB-driven', 'Receiving, Grading Task, Confirmation, Retur Report', 'No', 'No', 'No', 'No', 'No', 'Seeded in repo via dir_user_roles_qc_staff.sql.'],
  ['qc_coordinator', 'Yes', 'DB-driven', 'DB-driven', 'No', 'No', 'No', 'No', 'No', 'Role exists, but QC permissions depend on dir_user_roles rows in database.'],
  ['qc_inspector', 'Yes', 'DB-driven', 'DB-driven', 'No', 'No', 'No', 'No', 'No', 'Role exists, but repo has no direct QC permission seed for it.'],
  ['storage_staff', 'Yes', 'DB-driven', 'No', 'No', 'No', 'No', 'No', 'No', 'Storage permissions are supported in code but seeded rows were not found in repo.'],
  ['storage_coordinator', 'Yes', 'DB-driven', 'No', 'No', 'No', 'No', 'No', 'No', 'Storage permissions are supported in code but seeded rows were not found in repo.'],
  ['arkline_viewer', 'Yes', 'No', 'No', 'Overview, Product Directory, Progress Snapshot', 'No', 'No', 'No', 'No', 'Calendar + Product Snapshot enabled. No Kanban.'],
  ['arkline_purchaser', 'Yes', 'No', 'No', 'Overview, Directory, BOM, Progress, Production Planning, Finance', 'No', 'No', 'No', 'No', 'Also has reimbursement permissions in SQL, though not surfaced in current menu helper.'],
  ['inbound_staff', 'Yes', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'Role exists, but inbound menu/path is hard-disabled for non-admin in current code.'],
  ['packing_staff', 'Yes', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'Role exists, but packing menu/path is hard-disabled for non-admin in current code.'],
]

const arklineRows = [
  ['admin', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['hrga', 'Yes', 'Yes', 'Yes', 'No', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['arkline_viewer', 'Yes', 'Yes', 'No', 'No', 'No', 'Yes', 'Yes', 'No'],
  ['arkline_purchaser', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
]

const qcRows = [
  ['admin', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['qc_staff', 'No', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['qc_coordinator', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven'],
  ['qc_inspector', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven'],
]

const storageRows = [
  ['admin', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['storage_staff', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven'],
  ['storage_coordinator', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven', 'DB-driven'],
]

const notes = [
  'Source of truth used for this PDF: utils/permissions.js, app/dashboard/layout.js, app/dashboard/arkline/use-arkline-access.js, and repo SQL permission seed files.',
  'All signed-in users can reach /dashboard, /dashboard/profile, and /dashboard/myarklife by current code.',
  'Inbound, Packing List, Settings, and User Access are currently admin-only in code.',
  'DB-driven means the helper supports the module, but this repo does not contain a matching role-permission seed for that role/module combination.',
  'Admin access is also elevated by ADMIN_EMAIL in utils/permissions.js.',
]

const explainLikeBaby = [
  'Hardcoded: aturan sudah ditulis langsung di kode. Ibaratnya tombolnya dilas permanen, jadi user biasa tidak bisa ubah dari layar setting.',
  'Based on user setting / DB-driven: aturan dibaca dari isi database, jadi kalau role atau permission di tabel diubah, akses user ikut berubah.',
  'No seed: di repo ini belum ada file contoh pengisian awal untuk role itu. Jadi mungkin bisa jalan kalau datanya sudah ada di database, tapi dari kode repo saja kita belum lihat isi awalnya.',
  'Mixed: sebagian keputusan dari kode, sebagian lagi dari database. Contoh: module Arkline bisa muncul kalau permission di DB ada, tapi Inbound tetap dipaksa mati untuk non-admin karena kodenya memang begitu.',
]

function ensureDir(target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }
}

function wrap(doc, text, width) {
  return doc.splitTextToSize(String(text || '-'), width)
}

function drawSectionTitle(doc, title, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text(title, 14, y)
  return y + 6
}

function drawParagraphList(doc, items, y, maxWidth) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  let cursor = y
  items.forEach((item) => {
    const lines = wrap(doc, `- ${item}`, maxWidth)
    doc.text(lines, 16, cursor)
    cursor += lines.length * 4.3 + 1
  })
  return cursor
}

function drawTable(doc, columns, rows, startY, options = {}) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const tableWidth = pageWidth - margin * 2
  const colWidths = options.colWidths || new Array(columns.length).fill(tableWidth / columns.length)
  let y = startY

  const ensureSpace = (neededHeight) => {
    if (y + neededHeight <= pageHeight - 12) return
    doc.addPage()
    y = 14
  }

  const drawRow = (cells, isHeader = false) => {
    const paddingX = 2
    const paddingY = 2.2
    const wrapped = cells.map((cell, index) => wrap(doc, cell, colWidths[index] - paddingX * 2))
    const lineCount = Math.max(...wrapped.map((lines) => lines.length), 1)
    const rowHeight = lineCount * 4 + paddingY * 2
    ensureSpace(rowHeight + 2)

    let x = margin
    wrapped.forEach((lines, index) => {
      if (isHeader) {
        doc.setFillColor(15, 23, 42)
        doc.setDrawColor(203, 213, 225)
        doc.roundedRect(x, y, colWidths[index], rowHeight, 0, 0, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(255, 255, 255)
      } else {
        doc.setFillColor(index === 0 ? 248 : 255, index === 0 ? 250 : 255, index === 0 ? 252 : 255)
        doc.setDrawColor(226, 232, 240)
        doc.rect(x, y, colWidths[index], rowHeight, 'FD')
        doc.setFont('helvetica', index === 0 ? 'bold' : 'normal')
        doc.setFontSize(7.7)
        doc.setTextColor(15, 23, 42)
      }
      doc.text(lines, x + paddingX, y + paddingY + 2.2)
      x += colWidths[index]
    })
    y += rowHeight
  }

  drawRow(columns, true)
  rows.forEach((row) => drawRow(row, false))
  return y + 6
}

function drawFlowBox(doc, box) {
  const palette = {
    hardcoded: {
      fill: [15, 23, 42],
      text: [255, 255, 255],
      border: [15, 23, 42],
    },
    db: {
      fill: [232, 244, 255],
      text: [15, 23, 42],
      border: [96, 165, 250],
    },
    mixed: {
      fill: [241, 245, 249],
      text: [15, 23, 42],
      border: [100, 116, 139],
    },
  }

  const style = palette[box.kind] || palette.mixed
  doc.setFillColor(...style.fill)
  doc.setDrawColor(...style.border)
  doc.roundedRect(box.x, box.y, box.w, box.h, 4, 4, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...style.text)
  const titleLines = wrap(doc, box.title, box.w - 8)
  doc.text(titleLines, box.x + 4, box.y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const bodyLines = wrap(doc, box.body, box.w - 8)
  doc.text(bodyLines, box.x + 4, box.y + 13)
}

function drawArrow(doc, x1, y1, x2, y2, label = '') {
  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.7)
  doc.line(x1, y1, x2, y2)

  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 3
  doc.line(x2, y2, x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6))
  doc.line(x2, y2, x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6))

  if (label) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(71, 85, 105)
    doc.text(label, (x1 + x2) / 2 - 5, (y1 + y2) / 2 - 1.5)
  }
}

function drawLegend(doc, x, y) {
  const items = [
    { label: 'Hardcoded', kind: 'hardcoded' },
    { label: 'User setting / DB', kind: 'db' },
    { label: 'Campuran', kind: 'mixed' },
  ]

  items.forEach((item, index) => {
    const boxX = x + index * 52
    drawFlowBox(doc, {
      x: boxX,
      y,
      w: 42,
      h: 12,
      title: item.label,
      body: '',
      kind: item.kind,
    })
  })
}

function buildPdf() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42)
  doc.text('Warehouse MS - User Profile, Role, and Module Access Matrix', 14, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Generated from current code and permission seed files on 06 June 2026.', 14, 22)

  let y = 30
  y = drawSectionTitle(doc, 'Top-Level Module Access', y)
  y = drawTable(
    doc,
    ['Role', 'Dashboard', 'Storage', 'QC', 'Arkline', 'HRGA', 'Inbound', 'Packing', 'Settings', 'Notes'],
    topLevelRows,
    y,
    {
      colWidths: [28, 18, 21, 30, 43, 16, 16, 16, 18, 69],
    }
  )

  y = drawSectionTitle(doc, 'Arkline Detailed Access Snapshot', y)
  y = drawTable(
    doc,
    ['Role', 'Overview', 'Directory', 'BOM', 'Create/Edit', 'Kanban', 'Calendar', 'Products', 'Prod/Finance'],
    arklineRows,
    y,
    {
      colWidths: [32, 23, 23, 18, 24, 18, 20, 20, 34],
    }
  )

  y = drawSectionTitle(doc, 'QC Detailed Access Snapshot', y)
  y = drawTable(
    doc,
    ['Role', 'Summary', 'Receiving', 'Grading Task', 'Confirmation', 'Retur'],
    qcRows,
    y,
    {
      colWidths: [34, 24, 28, 32, 30, 22],
    }
  )

  y = drawSectionTitle(doc, 'Storage Detailed Access Snapshot', y)
  y = drawTable(
    doc,
    ['Role', 'Overview', 'Registry', 'Search', 'Restock Submit', 'Restock Picker'],
    storageRows,
    y,
    {
      colWidths: [40, 28, 28, 26, 34, 34],
    }
  )

  doc.addPage()
  y = 16
  y = drawSectionTitle(doc, 'Notes and Assumptions', y)
  y = drawParagraphList(doc, notes, y, 255)

  y += 4
  y = drawSectionTitle(doc, 'Current Roles Registered in Code', y)
  y = drawParagraphList(
    doc,
    [
      'admin',
      'storage_staff',
      'storage_coordinator',
      'inbound_staff',
      'qc_coordinator',
      'qc_staff',
      'qc_inspector',
      'packing_staff',
      'hrga',
      'hrga_approver',
      'arkline_viewer',
      'arkline_purchaser',
    ],
    y,
    255
  )

  y += 4
  y = drawSectionTitle(doc, 'Primary Source Files', y)
  drawParagraphList(
    doc,
    [
      'utils/permissions.js',
      'app/dashboard/layout.js',
      'app/dashboard/arkline/use-arkline-access.js',
      'supabase/arkline_permissions_checklist.sql',
      'supabase/arkline_roles_viewer_purchaser.sql',
      'supabase/hrga_role_arkline_access.sql',
      'supabase/dir_user_roles_qc_staff.sql',
    ],
    y,
    255
  )

  doc.addPage()
  y = 16
  y = drawSectionTitle(doc, 'How Access Flows Today', y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text('Legend:', 14, y)
  drawLegend(doc, 28, y - 4)
  y += 16

  const flowBoxes = [
    {
      x: 16,
      y: 40,
      w: 42,
      h: 24,
      title: '1. User login',
      body: 'User masuk ke sistem.',
      kind: 'mixed',
    },
    {
      x: 72,
      y: 40,
      w: 54,
      h: 24,
      title: '2. Check ADMIN_EMAIL',
      body: 'Kalau email sama dengan admin utama, akses dibuka penuh.',
      kind: 'hardcoded',
    },
    {
      x: 140,
      y: 40,
      w: 58,
      h: 24,
      title: '3. Read role from dir_user_profiles',
      body: 'Sistem ambil role user dari tabel profile.',
      kind: 'db',
    },
    {
      x: 212,
      y: 40,
      w: 58,
      h: 24,
      title: '4. Read permissions from dir_user_roles',
      body: 'Sistem ambil daftar izin detail per user role.',
      kind: 'db',
    },
    {
      x: 30,
      y: 88,
      w: 64,
      h: 28,
      title: '5. Always allowed pages',
      body: '/dashboard, /profile, /myarklife selalu boleh untuk user yang sudah login.',
      kind: 'hardcoded',
    },
    {
      x: 108,
      y: 88,
      w: 64,
      h: 28,
      title: '6. Arkline / QC / Storage',
      body: 'Muncul atau tidak tergantung permission code di database.',
      kind: 'db',
    },
    {
      x: 186,
      y: 88,
      w: 84,
      h: 28,
      title: '7. Forced off for non-admin',
      body: 'Inbound, Packing, Settings, dan User Access dipaksa mati kalau bukan admin.',
      kind: 'hardcoded',
    },
    {
      x: 84,
      y: 136,
      w: 120,
      h: 30,
      title: '8. Final sidebar + page access',
      body: 'Sidebar dibentuk dari getAllowedMenus(), lalu setiap page dicek lagi lewat canAccessPath(). Jadi hasil akhir adalah campuran aturan kode dan isi database.',
      kind: 'mixed',
    },
  ]

  flowBoxes.forEach((box) => drawFlowBox(doc, box))

  drawArrow(doc, 58, 52, 72, 52)
  drawArrow(doc, 126, 52, 140, 52)
  drawArrow(doc, 198, 52, 212, 52)
  drawArrow(doc, 241, 64, 241, 88, 'pakai data')
  drawArrow(doc, 169, 64, 140, 88, 'cek akses')
  drawArrow(doc, 99, 64, 62, 88, 'allow tetap')
  drawArrow(doc, 228, 64, 228, 88, 'hard stop')
  drawArrow(doc, 62, 116, 118, 136)
  drawArrow(doc, 140, 116, 144, 136)
  drawArrow(doc, 228, 116, 178, 136)

  y = 182
  y = drawSectionTitle(doc, 'Bahasa Bayi Version', y)
  drawParagraphList(doc, explainLikeBaby, y, 255)

  return doc
}

ensureDir(outputDir)
const doc = buildPdf()
const bytes = doc.output('arraybuffer')
const buffer = Buffer.from(bytes)

try {
  fs.writeFileSync(outputFile, buffer)
  console.log(outputFile)
} catch (error) {
  if (error && error.code === 'EBUSY') {
    const fallbackFile = path.join(outputDir, 'user-role-access-matrix-latest.pdf')
    fs.writeFileSync(fallbackFile, buffer)
    console.log(fallbackFile)
  } else {
    throw error
  }
}
