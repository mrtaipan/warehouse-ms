'use client'

export const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
export const ORDERED_AS_OPTIONS = ['PT ANUGERAH RETAIL KARYA', 'CV MITRA KARSA GARMINDO']

export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'with', 'with ppn'].includes(normalized)) return true
    if (['false', 'no', 'without', 'without ppn'].includes(normalized)) return false
  }
  return fallback
}

export function formatQuantity(value) {
  const number = toNumber(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatPrintDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildRemarksHtml(value) {
  const lines = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.trim()
      if (!trimmed) return []

      const numberedParts = trimmed.match(/\d+\.\s+.*?(?=\s+\d+\.\s+|$)/g)
      return numberedParts?.length > 1 ? numberedParts.map((part) => part.trim()) : [trimmed]
    })

  return lines.length
    ? lines.map((line) => `<div class="mb-1">${escapeHtml(line)}</div>`).join('')
    : `<div>${escapeHtml(value)}</div>`
}

function buildMultilineHtml(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br />')
}

export function normalizeSupplier(row) {
  return {
    id: String(row?.id || '').trim(),
    supplierName: String(row?.supplier_name || '').trim().toUpperCase(),
    contactPerson: String(row?.contact_person || '').trim().toUpperCase(),
    phone: String(row?.phone || '').trim(),
    address: String(row?.address || '').trim().toUpperCase(),
  }
}

export function getLineTotalQty(line) {
  if (line?.qtyBySize) {
    return Object.values(line.qtyBySize).reduce((sum, value) => sum + toNumber(value), 0)
  }
  return toNumber(line?.totalQty ?? line?.total_qty ?? line?.qty)
}

export function buildSizeBreakdown(qtyBySize) {
  return SIZE_OPTIONS.filter((size) => toNumber(qtyBySize?.[size]) > 0)
    .map((size) => `${size} ${formatQuantity(qtyBySize[size])}`)
    .join(' • ')
}

export function normalizeStatusLabel(value) {
  const normalized = String(value || '-').trim()
  if (!normalized) return '-'
  return normalized
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getStatusTone(value) {
  const status = String(value || '').trim().toUpperCase()
  if (['COMPLETED', 'CLOSED', 'RECEIVED'].includes(status)) return 'success'
  if (['ON PROGRESS', 'IN PROGRESS', 'ONGOING', 'PARTIALLY_RECEIVED', 'SENT', 'ORDERED'].includes(status)) return 'progress'
  if (['CANCELLED', 'CANCELED'].includes(status)) return 'danger'
  return 'neutral'
}

export async function fetchSupplierById(supabase, supplierId) {
  if (supplierId == null || supplierId === '') return null

  const { data, error } = await supabase
    .from('dir_suppliers')
    .select('id, supplier_name, contact_person, phone, address')
    .eq('id', supplierId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return data ? normalizeSupplier(data) : null
}

export async function fetchGarmentPoBundle(supabase, poId) {
  const normalizedPoId = String(poId || '').trim().toUpperCase()
  const { data: poRow, error: poError } = await supabase
    .from('arkline_pos')
    .select('*')
    .eq('po_id', normalizedPoId)
    .maybeSingle()

  if (poError) throw new Error(poError.message)
  if (!poRow) throw new Error('Garment PO not found.')

  const supplier = await fetchSupplierById(supabase, poRow.supplier_id)

  const { data: itemRows, error: itemError } = await supabase
    .from('arkline_po_items')
    .select('*')
    .eq('po_id', poRow.po_id)
    .order('created_at', { ascending: true })

  if (itemError) throw new Error(itemError.message)

  const itemIds = (itemRows || []).map((item) => item.id).filter(Boolean)
  const { data: sizeRows, error: sizeError } =
    itemIds.length > 0
      ? await supabase.from('arkline_po_item_sizes').select('*').in('arkline_po_item_id', itemIds).order('size', { ascending: true })
      : { data: [], error: null }

  if (sizeError) throw new Error(sizeError.message)

  const sizeRowsByItem = (sizeRows || []).reduce((accumulator, row) => {
    const key = String(row.arkline_po_item_id || '')
    if (!accumulator[key]) accumulator[key] = []
    accumulator[key].push(row)
    return accumulator
  }, {})

  const items = (itemRows || []).map((item) => {
    const qtyBySize = SIZE_OPTIONS.reduce((accumulator, size) => {
      accumulator[size] = ''
      return accumulator
    }, {})

    ;(sizeRowsByItem[String(item.id || '')] || []).forEach((sizeRow) => {
      const sizeKey = String(sizeRow.size || '').trim().toUpperCase()
      if (!Object.prototype.hasOwnProperty.call(qtyBySize, sizeKey)) return
      qtyBySize[sizeKey] = String(sizeRow.qty || '')
    })

    return {
      id: String(item.id || '').trim(),
      skuInduk: String(item.sku_induk || '').trim().toUpperCase(),
      namaProdukSnapshot: String(item.nama_produk || '').trim().toUpperCase(),
      kategoriProdukSnapshot: String(item.kategori_produk || '').trim().toUpperCase(),
      totalQty: toNumber(item.total_qty),
      actualQty: toNumber(item.actual_qty),
      price: toNumber(item.price ?? item.hpp),
      notes: String(item.notes || '').trim(),
      status: String(item.status || poRow.status || '').trim(),
      qtyBySize,
    }
  })

  return { po: poRow, supplier, items }
}

export async function fetchMaterialPoBundle(supabase, materialPoNumber) {
  const normalizedPoNumber = String(materialPoNumber || '').trim().toUpperCase()
  const { data: poRow, error: poError } = await supabase
    .from('arkline_po_material_ordered')
    .select('*')
    .eq('material_po_number', normalizedPoNumber)
    .maybeSingle()

  if (poError) throw new Error(poError.message)
  if (!poRow) throw new Error('Material PO not found.')

  const supplier = await fetchSupplierById(supabase, poRow.supplier_id)

  const { data: itemRows, error: itemError } = await supabase
    .from('arkline_po_material_ordered_items')
    .select('*')
    .eq('material_po_number', poRow.material_po_number)
    .order('created_at', { ascending: true })

  if (itemError) throw new Error(itemError.message)

  const items = (itemRows || []).map((item) => ({
    id: String(item.id || '').trim(),
    materialName: String(item.material_name_snapshot || '').trim().toUpperCase(),
    variant: [item.size_variant, item.color_variant].filter(Boolean).join(' / ') || '-',
    unit: String(item.unit || '').trim().toUpperCase(),
    qty: toNumber(item.qty),
    price: toNumber(item.price),
    amount: toNumber(item.amount) || toNumber(item.qty) * toNumber(item.price),
    notes: String(item.notes || '').trim(),
    sourcePoId: String(item.source_po_id || '').trim().toUpperCase(),
  }))

  return { po: poRow, supplier, items }
}

function buildPrintShell({ title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @page { size: A4; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head>
  <body class="bg-gray-100 min-h-screen py-10 print:bg-white print:py-0">
    <div class="print:hidden sticky top-0 z-10 flex justify-center gap-3 bg-gray-100/90 px-4 pb-4">
      <button onclick="window.print()" class="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800">Print PDF</button>
      <button onclick="window.close()" class="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Close</button>
    </div>
    ${body}
  </body>
</html>`
}

function buildCompanyBlock(orderedAs = 'PT ANUGERAH RETAIL KARYA') {
  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/Gemini_Generated_Image_1pgskj1pgskj1pgs.png`
      : '/Gemini_Generated_Image_1pgskj1pgskj1pgs.png'

  return `
    <div class="flex w-[55%] -mt-2 flex-col items-end">
      <div class="w-full max-w-[320px] text-left">
        <div class="mb-2 h-[34px] w-[230px] overflow-hidden bg-white">
          <img src="${escapeHtml(logoUrl)}" alt="Arkline" class="block h-auto w-[230px] max-w-none -translate-y-[26px] object-contain" />
        </div>
        <div class="mb-2 mt-1 text-[11pt] font-semibold tracking-wide">
          <span class="block pl-[18px]">${escapeHtml(orderedAs || '-')}</span>
        </div>
        <div class="pl-[18px] text-[8.5pt] leading-relaxed text-gray-600">
          North Point Commercial blok NP 22,<br />
          Jl. BSD Boulevard Utara, Lengkong Kulon,<br />
          Pagedangan, Tangerang Regency,<br />
          Banten 1533
        </div>
      </div>
    </div>`
}

function buildSupplierBlock({ label = 'PO To', supplierName, supplierAddress, supplierContact }) {
  return `
    <div class="mt-6">
      <div class="mb-1 text-[7pt] font-bold uppercase tracking-widest text-gray-500">${escapeHtml(label)}</div>
      <div class="mb-1 text-[11pt] font-semibold">${escapeHtml(supplierName || '-')}</div>
      <div class="text-[8.5pt] leading-relaxed text-gray-600">
        <div>${buildMultilineHtml(supplierAddress || 'Alamat supplier belum diisi.')}</div>
        ${supplierContact ? `<div class="mt-1">Attn: ${escapeHtml(supplierContact)}</div>` : ''}
      </div>
    </div>`
}

function buildTotalsAndSignature({ subtotal, includePpn }) {
  const ppn = includePpn ? subtotal * 0.11 : 0
  const total = subtotal + ppn

  return `
    <div class="flex min-h-[360px] w-[45%] flex-col justify-between pb-6">
      <table class="w-full text-[9.5pt]">
        <tbody>
          <tr>
            <td class="py-2 text-[7pt] font-bold uppercase tracking-widest text-gray-400">Subtotal</td>
            <td class="py-2 text-right text-gray-700">${escapeHtml(formatCurrency(subtotal))}</td>
          </tr>
          ${
            includePpn
              ? `<tr>
                  <td class="py-2 text-[7pt] font-bold uppercase tracking-widest text-gray-400">PPN 11%</td>
                  <td class="py-2 text-right text-gray-700">${escapeHtml(formatCurrency(ppn))}</td>
                </tr>`
              : ''
          }
          <tr class="border-t-[1.5px] border-black text-[11.5pt] font-bold">
            <td class="pt-3 text-[7pt] font-bold uppercase tracking-widest text-black">Total</td>
            <td class="pt-3 text-right text-black">${escapeHtml(formatCurrency(total))}</td>
          </tr>
        </tbody>
      </table>

      <div class="mt-20 text-right">
        <div class="mb-2 inline-block w-[180px] border-b border-black"></div>
        <div class="text-[10.5pt] font-semibold tracking-wide text-black">Aditya C. S.</div>
        <div class="text-[8.5pt] font-medium text-gray-500">President Director</div>
      </div>
    </div>`
}

function buildFooter() {
  return `
    <div class="mt-8 border-t border-gray-200 pt-3 text-center text-[7.5pt] leading-relaxed text-gray-500">
      <span class="font-bold uppercase tracking-widest text-gray-600">Warehouse:</span>
      Pergudangan Bizpoint, Point 5 LV No. 85, Tigaraksa, Cikupa, Kab. Tangerang-Banten, Kode pos 15710
    </div>`
}

export async function createGarmentPurchaseOrderPreviewHtml(bundle) {
  const printableItems = bundle.items.map((item) => {
    const qty = getLineTotalQty(item)
    const price = toNumber(item.price)
    return {
      name: item.namaProdukSnapshot || '-',
      qty,
      price,
      amount: qty * price,
      sizeBreakdown: buildSizeBreakdown(item.qtyBySize),
    }
  })

  const includePpn = normalizeBoolean(bundle.header.includePpn, true)
  const subtotal = printableItems.reduce((sum, item) => sum + item.amount, 0)
  const remarks =
    String(bundle.header.notes || '').trim() ||
    'Mohon cantumkan nomor Purchase Order ini pada Invoice, Surat Jalan, dan dokumen pengiriman lainnya.'

  const itemRowsHtml = printableItems
    .map(
      (item) => `
        <tr class="border-b border-gray-200">
          <td class="py-4 px-1 text-left font-medium">
            <div>${escapeHtml(item.name)}</div>
            ${item.sizeBreakdown ? `<div class="mt-1 text-[8pt] text-gray-500">${escapeHtml(item.sizeBreakdown)}</div>` : ''}
          </td>
          <td class="py-4 px-1 text-center text-gray-600">${escapeHtml(formatQuantity(item.qty))}</td>
          <td class="py-4 px-1 text-right text-gray-600">${escapeHtml(formatCurrency(item.price))}</td>
          <td class="py-4 px-1 text-right font-medium">${escapeHtml(formatCurrency(item.amount))}</td>
        </tr>`
    )
    .join('')

  const body = `
    <div class="mx-auto min-h-[297mm] w-[210mm] bg-white p-[20mm] font-sans text-[#111] shadow-lg print:min-h-0 print:w-full print:p-[20mm] print:shadow-none">
      <div class="mb-14 flex items-start justify-between">
        <div class="flex w-[45%] flex-col gap-3">
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">PO Number</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.poId || '-')}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.poCreatedAt))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Request Delivery Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.header.requestDeliveryDate))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Payment Terms</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.header.paymentTerms || bundle.method || '-')}</div>
          </div>
          ${buildSupplierBlock({
            supplierName: bundle.header.supplierName,
            supplierAddress: bundle.header.supplierAddress,
            supplierContact: bundle.header.supplierContact,
          })}
        </div>
        ${buildCompanyBlock('PT ANUGERAH RETAIL KARYA')}
      </div>

      <table class="mb-16 w-full border-collapse">
        <thead>
          <tr class="border-b-[1.5px] border-black">
            <th class="px-1 py-3 text-left text-[7pt] font-bold uppercase tracking-widest text-gray-700">Produk</th>
            <th class="w-[12%] px-1 py-3 text-center text-[7pt] font-bold uppercase tracking-widest text-gray-700">Qty</th>
            <th class="w-[22%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Price</th>
            <th class="w-[25%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Amount</th>
          </tr>
        </thead>
        <tbody class="text-[9.5pt]">
          ${
            itemRowsHtml ||
            `<tr><td colspan="4" class="px-1 py-8 text-center text-[9pt] text-gray-500">No item lines saved for this PO.</td></tr>`
          }
        </tbody>
      </table>

      <div class="print:break-inside-avoid flex min-h-[360px] items-end justify-between">
        <div class="flex min-h-[360px] w-[50%] flex-col justify-between pb-6">
          <div>
            <div class="mb-1 text-[7pt] font-bold uppercase tracking-widest text-gray-500">Remarks</div>
            <div class="max-w-[90%] text-[9pt] leading-relaxed text-gray-600">${buildRemarksHtml(remarks)}</div>
          </div>
          <div class="mt-16 text-[36pt] font-bold leading-[0.95] tracking-tighter text-black">PURCHASE<br />ORDER</div>
        </div>
        ${buildTotalsAndSignature({ subtotal, includePpn })}
      </div>
      ${buildFooter()}
    </div>`

  return buildPrintShell({ title: bundle.poId || 'Purchase Order', body })
}

export async function createMaterialPurchaseOrderPreviewHtml(bundle) {
  const includePpn = normalizeBoolean(bundle.header.includePpn, true)
  const orderedAs = String(bundle.header.orderedAs || ORDERED_AS_OPTIONS[0]).trim().toUpperCase()
  const subtotal = bundle.items.reduce((sum, item) => sum + toNumber(item.amount), 0)
  const remarks =
    String(bundle.header.notes || '').trim() ||
    'Mohon cantumkan nomor Purchase Order ini pada Invoice, Surat Jalan, dan dokumen pengiriman lainnya.'

  const itemRowsHtml = bundle.items
    .map(
      (item) => `
        <tr class="border-b border-gray-200">
          <td class="py-4 px-1 text-left font-medium">
            <div>${escapeHtml(item.materialName || '-')}</div>
            ${
              [item.variant, item.unit].filter((value) => value && value !== '-').length
                ? `<div class="mt-1 text-[8pt] text-gray-500">${escapeHtml([item.variant, item.unit].filter((value) => value && value !== '-').join(' - '))}</div>`
                : ''
            }
            ${item.notes ? `<div class="mt-1 text-[8pt] leading-relaxed text-gray-500">${buildMultilineHtml(item.notes)}</div>` : ''}
          </td>
          <td class="py-4 px-1 text-center text-gray-600">${escapeHtml(formatQuantity(item.qty))}</td>
          <td class="py-4 px-1 text-right text-gray-600">${escapeHtml(formatCurrency(item.price))}</td>
          <td class="py-4 px-1 text-right font-medium">${escapeHtml(formatCurrency(item.amount))}</td>
        </tr>`
    )
    .join('')

  const body = `
    <div class="mx-auto min-h-[297mm] w-[210mm] bg-white p-[20mm] font-sans text-[#111] shadow-lg print:min-h-0 print:w-full print:p-[20mm] print:shadow-none">
      <div class="mb-14 flex items-start justify-between">
        <div class="flex w-[45%] flex-col gap-3">
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">PO Number</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.poNumber || '-')}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.createdAt))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Request Delivery Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.header.requestDeliveryDate))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Payment Terms</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.header.paymentTerms || '-')}</div>
          </div>
          ${buildSupplierBlock({
            supplierName: bundle.header.supplierName,
            supplierAddress: bundle.header.supplierAddress,
            supplierContact: bundle.header.supplierContact,
          })}
        </div>
        ${buildCompanyBlock(orderedAs)}
      </div>

      <table class="mb-16 w-full border-collapse">
        <thead>
          <tr class="border-b-[1.5px] border-black">
            <th class="px-1 py-3 text-left text-[7pt] font-bold uppercase tracking-widest text-gray-700">Material</th>
            <th class="w-[12%] px-1 py-3 text-center text-[7pt] font-bold uppercase tracking-widest text-gray-700">Qty</th>
            <th class="w-[22%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Price</th>
            <th class="w-[25%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Amount</th>
          </tr>
        </thead>
        <tbody class="text-[9.5pt]">
          ${
            itemRowsHtml ||
            `<tr><td colspan="4" class="px-1 py-8 text-center text-[9pt] text-gray-500">No material lines found for this purchase order.</td></tr>`
          }
        </tbody>
      </table>

      <div class="print:break-inside-avoid flex min-h-[360px] items-end justify-between">
        <div class="flex min-h-[360px] w-[50%] flex-col justify-between pb-6">
          <div>
            <div class="mb-1 text-[7pt] font-bold uppercase tracking-widest text-gray-500">Remarks</div>
            <div class="max-w-[90%] text-[9pt] leading-relaxed text-gray-600">${buildRemarksHtml(remarks)}</div>
          </div>
          <div class="mt-16 text-[36pt] font-bold leading-[0.95] tracking-tighter text-black">PURCHASE<br />ORDER</div>
        </div>
        ${buildTotalsAndSignature({ subtotal, includePpn })}
      </div>
      ${buildFooter()}
    </div>`

  return buildPrintShell({ title: bundle.poNumber || 'Material Purchase Order', body })
}

export function openPreviewWindow(waitingText = 'Preparing purchase order preview...') {
  const previewWindow = window.open('', '_blank')
  if (!previewWindow) {
    throw new Error('Popup blocked. Please allow popups to preview the PDF.')
  }
  previewWindow.document.write(`<html><body style="font-family: Arial, sans-serif; padding: 24px;">${escapeHtml(waitingText)}</body></html>`)
  previewWindow.document.close()
  return previewWindow
}
