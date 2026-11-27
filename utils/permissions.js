import { DELIVERY_ACCESS_CONFIGURED, DELIVERY_PERMISSION_ITEMS } from './delivery-access.mjs'
export const ADMIN_EMAIL = 'mr.peneliti@gmail.com'

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'hrga', label: 'HRGA' },
  { value: 'leader', label: 'Leader' },
  { value: 'mob_cs', label: 'MOB CS' },
  { value: 'arkline_cs', label: 'Arkline CS' },
  { value: 'oi_cs', label: 'OI CS' },
  { value: 'warehouse_leader', label: 'Warehouse Leader' },
  { value: 'packing_coordinator', label: 'Packing Coordinator' },
  { value: 'packing_staff', label: 'Packing Staff' },
  { value: 'qc_coordinator', label: 'QC Coordinator' },
  { value: 'qc_staff', label: 'QC Staff' },
  { value: 'qc_inspector', label: 'QC Inspector' },
  { value: 'storage_coordinator', label: 'Storage Coordinator' },
  { value: 'storage_staff', label: 'Storage Staff' },
  { value: 'inbound_coordinator', label: 'Inbound Coordinator' },
  { value: 'inbound_staff', label: 'Inbound Staff' },
  { value: 'arkline_staff', label: 'Arkline Staff' },
  { value: 'arkline_merchandiser', label: 'Arkline Merchandiser' },
  { value: 'arkline_host', label: 'Arkline Host' },
  { value: 'external', label: 'External' },
  { value: 'guest', label: 'Guest' },
]

export const OFFICIAL_ROLE_VALUES = ROLE_OPTIONS.map((item) => item.value)

export const LEGACY_ROLE_MAP = {
  arkline_viewer: 'arkline_staff',
  arkline_purchaser: 'arkline_merchandiser',
}

export const ROLE_LOCKED_GROUPS = {
  arkline_cs: 'ARKLINE',
  mob_cs: 'MOB',
  oi_cs: 'OI',
}

export const DASHBOARD_SHORTCUT_CODES = {
  search: 'dashboard.shortcuts.search.visible',
  restockRequest: 'dashboard.shortcuts.restock_request.visible',
  stockReplenishment: 'dashboard.shortcuts.stock_replenishment.visible',
  productLoanRequest: 'dashboard.shortcuts.product_loan_request.visible',
  penaltyPoints: 'dashboard.shortcuts.penalty_points.visible',
  deliveryReport: 'dashboard.shortcuts.delivery_report.visible',
  operationsCalendar: 'dashboard.shortcuts.operations_calendar.visible',
  myArklife: 'dashboard.shortcuts.myarklife.visible',
}
export const DASHBOARD_SHORTCUT_CONFIGURED_CODE = 'dashboard.shortcuts.configured.visible'
export const DASHBOARD_SHORTCUT_REQUIRED_PERMISSIONS = {
  [DASHBOARD_SHORTCUT_CODES.search]: ['storage.location.current_stock.view'],
  [DASHBOARD_SHORTCUT_CODES.restockRequest]: ['storage.restock_submit.view', 'storage.restock_submit.add'],
  [DASHBOARD_SHORTCUT_CODES.stockReplenishment]: ['storage.restock_picker.view', 'storage.restock_picker.edit'],
  [DASHBOARD_SHORTCUT_CODES.productLoanRequest]: ['storage.location.product_loans.view', 'storage.location.product_loans.edit'],
  [DASHBOARD_SHORTCUT_CODES.penaltyPoints]: ['hrga.penalty_points.view'],
  [DASHBOARD_SHORTCUT_CODES.deliveryReport]: ['delivery_report.view'],
  [DASHBOARD_SHORTCUT_CODES.operationsCalendar]: ['dashboard.operations_calendar.view'],
  [DASHBOARD_SHORTCUT_CODES.myArklife]: ['myarklife.view'],
}

export function getRoleLockedGroup(role) {
  return ROLE_LOCKED_GROUPS[String(role || '').trim().toLowerCase()] || ''
}

const BASE_PERMISSION_GROUPS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    items: [
      {
        key: 'home',
        label: 'Dashboard Home',
        description: 'Halaman awal dashboard utama setelah login.',
        actions: ['view'],
      },
      {
        key: 'myarklife',
        label: 'MyArklife',
        codePrefix: 'myarklife',
        description: 'Halaman self-service untuk kebutuhan pribadi seperti leave, reimbursement, dan birthday gift.',
        actions: ['view'],
      },
      {
        key: 'operations_calendar',
        label: 'Operations Calendar',
        description: 'Lihat timeline dan kalender aktivitas operasional Inbound, QC, Packing List, dan Stockkeeping.',
        actions: ['view'],
      },
      { key: 'restock_instruction', label: 'Restock Instruction', codePrefix: 'storage.restock_instruction', description: 'Pintu masuk cepat untuk restock submit dan restock picker.', actions: ['view'] },
      { key: 'restock_instruction.submit', label: 'Restock Submit', codePrefix: 'storage.restock_submit', description: 'Buat dan ubah permintaan restock internal.', actions: ['view', 'add', 'edit'] },
      { key: 'restock_instruction.picker', label: 'Restock Picker', codePrefix: 'storage.restock_picker', description: 'Proses pengambilan barang untuk restock instruction.', actions: ['view', 'edit'] },
      { key: 'shortcuts.search', label: 'Search', codePrefix: 'dashboard.shortcuts.search', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.restock_instruction.restock_request', label: 'Restock Request', codePrefix: 'dashboard.shortcuts.restock_request', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.restock_instruction.stock_replenishment', label: 'Stock Replenishment', codePrefix: 'dashboard.shortcuts.stock_replenishment', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.restock_instruction.product_loan_request', label: 'Product Loan Request', codePrefix: 'dashboard.shortcuts.product_loan_request', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.penalty_points', label: 'Penalty Points', codePrefix: 'dashboard.shortcuts.penalty_points', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.delivery_report', label: 'Delivery Report', codePrefix: 'dashboard.shortcuts.delivery_report', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.operations_calendar', label: 'Operations Calendar', codePrefix: 'dashboard.shortcuts.operations_calendar', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.myarklife', label: 'MyARKLIFE', codePrefix: 'dashboard.shortcuts.myarklife', actions: ['visible'], visibilityOnly: true },
      { key: 'shortcuts.configured', label: 'Dashboard shortcut preferences configured', codePrefix: 'dashboard.shortcuts.configured', actions: ['visible'], hidden: true },
    ],
  },
  {
    key: 'delivery_report',
    label: 'Delivery Report',
    items: [
      {
        key: 'home',
        label: 'Module Access',
        codePrefix: 'delivery_report',
        description: 'Akses halaman Delivery Report System dari dashboard WMS.',
        actions: ['view'],
      },
      ...DELIVERY_PERMISSION_ITEMS.map(({ key, label }) => ({ key, label, actions: ['view'] })),
      { key: 'configured', label: 'Delivery preferences configured', codePrefix: DELIVERY_ACCESS_CONFIGURED.replace(/\.visible$/, ''), actions: ['visible'], hidden: true },
    ],
  },
  {
    key: 'hrga',
    label: 'HRGA',
    items: [
      { key: 'home', label: 'People Management', description: 'Overview HRGA untuk melihat people data dan request panel.', actions: ['view'] },
      { key: 'announcement', label: 'Announcement', description: 'Kelola broadcast pengumuman internal perusahaan.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'people', label: 'People Directory', description: 'Lihat dan ubah data employee directory.', actions: ['view', 'edit'] },
      { key: 'public_request_links', label: 'Public Request Links', description: 'Buat dan kelola link request publik untuk employee.', actions: ['view', 'edit'] },
      { key: 'benefits', label: 'Benefits Hub', description: 'Lihat panel leave request, birthday gift request, dan reimbursement claims untuk kebutuhan HRGA.', actions: ['view'] },
      { key: 'penalty_points', label: 'Penalty Points', description: 'Lihat dan kelola poin penalty karyawan per periode 3 bulan.', actions: ['view', 'add', 'edit', 'delete'] },
    ],
  },
  {
    key: 'inbound',
    label: 'Inbound',
    items: [
      { key: 'receiving', label: 'Inbound Receiving', description: 'Lihat, buat, dan ubah data receiving inbound.', actions: ['view', 'add', 'edit'] },
      { key: 'unload', label: 'Inbound Unload', description: 'Lihat sorting & breakdown, input intake, dan ubah data unload inbound.', actions: ['view', 'add', 'edit'] },
    ],
  },
  {
    key: 'qc',
    label: 'Quality Control',
    items: [
      { key: 'summary', label: 'QC Summary', description: 'Halaman ringkasan performa dan hasil QC.', actions: ['view'] },
      { key: 'receiving', label: 'QC Receiving', description: 'Buat dan kelola rencana alokasi QC receiving.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'grading_task', label: 'Grading Task', description: 'Halaman kerja inspector untuk menjalankan tugas grading QC.', actions: ['view', 'add', 'edit'] },
      { key: 'confirmation', label: 'Grading Verification', description: 'Kelola verifikasi hasil grading QC.', actions: ['view', 'add', 'edit'] },
      { key: 'retur_report', label: 'Return Report', description: 'Kelola return reguler serta siklus return dan Re-QC Arkline.', actions: ['view', 'add', 'edit'] },
    ],
  },
  {
    key: 'packing',
    label: 'Packing List',
    items: [
      { key: 'overview', label: 'Packing Overview', description: 'Halaman utama workflow packing list.', actions: ['view'] },
      { key: 'receiving', label: 'Packing Receiving', description: 'Kelola input receiving untuk packing list.', actions: ['view', 'add', 'edit'] },
      { key: 'size_breakdown', label: 'Size Breakdown', description: 'Lihat dan ubah breakdown size untuk packing.', actions: ['view', 'edit'] },
    ],
  },
  {
    key: 'storage',
    label: 'Storage',
    items: [
      { key: 'location.current_stock', label: 'Current Stock', codePrefix: 'storage.location.current_stock', description: 'Lihat dan kelola stok yang tersimpan di lokasi warehouse.', actions: ['view', 'add', 'edit'] },
      { key: 'location.queue_area.storage_queue', label: 'Storage Queue', codePrefix: 'storage.location.queue_area.storage_queue', description: 'Lihat dan proses item pada storage queue.', actions: ['view', 'edit'] },
      { key: 'location.queue_area.shelving_queue', label: 'Shelving Queue', codePrefix: 'storage.location.queue_area.shelving_queue', description: 'Lihat dan proses item pada shelving queue.', actions: ['view', 'edit'] },
      { key: 'location.temp_area.temp_sales', label: 'Temp. Sales Area', codePrefix: 'storage.location.temp_area.temp_sales', description: 'Lihat dan kelola item pada temporary sales area.', actions: ['view', 'edit'] },
      { key: 'location.temp_area.temp_retur_keeping', label: 'Temp. Retur Keeping', codePrefix: 'storage.location.temp_area.temp_retur_keeping', description: 'Lihat dan kelola item pada temporary retur keeping.', actions: ['view', 'edit'] },
      { key: 'location.product_loans', label: 'Product Loans', codePrefix: 'storage.location.product_loans', description: 'Lihat dan kelola peminjaman produk.', actions: ['view', 'edit'] },
      { key: 'location.packaging_supplier', label: 'Packaging Supplier', codePrefix: 'storage.location.packaging_supplier', description: 'Lihat daftar dan informasi packaging supplier.', actions: ['view'] },
      { key: 'location.reject_storage', label: 'Reject Storage', codePrefix: 'storage.location.reject_storage', description: 'Lihat, kelola, dan cetak data reject storage.', actions: ['view', 'add', 'edit', 'print'] },
      { key: 'shelving_upload', label: 'Shelving Upload', description: 'Upload CSV penjualan harian untuk mengurangi stok shelving secara massal.', actions: ['view', 'add', 'edit'] },
      { key: 'history.pick_history', label: 'Pick History', codePrefix: 'storage.history.pick_history', description: 'Lihat histori pengambilan barang dari storage.', actions: ['view'] },
      { key: 'history.movement_history', label: 'Movement History', codePrefix: 'storage.history.movement_history', description: 'Lihat histori perpindahan barang antar area dan lokasi storage.', actions: ['view'] },
      { key: 'product_directory', label: 'Product Directory', description: 'Lihat dan kelola direktori produk, release, split, merge, dan photo workflow.', actions: ['view', 'add', 'edit'] },
    ],
  },
  {
    key: 'arkline',
    label: 'Arkline',
    items: [
      { key: 'overview', label: 'Arkline Overview', description: 'Halaman utama workspace Arkline.', actions: ['view'] },
      { key: 'directory', label: 'Directory', description: 'Pintu masuk halaman product directory Arkline.', actions: ['view'] },
      { key: 'directory.products', label: 'Products', description: 'Kelola daftar produk Arkline.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'directory.materials', label: 'Materials', description: 'Kelola master material Arkline.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'directory.bom', label: 'BOM', description: 'Kelola bill of materials produk Arkline.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'directory.suppliers', label: 'Suppliers', description: 'Kelola supplier Arkline dan asosiasi material yang dapat disupply.', actions: ['view', 'add', 'edit'] },
      { key: 'directory.purchase_orders', label: 'Purchase Order', description: 'Lihat dan cetak arsip garment serta material purchase order Arkline.', actions: ['view', 'print'] },
      { key: 'progress_snapshot', label: 'Progress Snapshot', description: 'Pintu masuk halaman progress snapshot Arkline.', actions: ['view'] },
      { key: 'progress_snapshot.kanban', label: 'Kanban', description: 'Lihat dan kelola kanban progress order Arkline.', actions: ['view', 'add', 'edit'] },
      { key: 'progress_snapshot.calendar', label: 'Calendar', description: 'Lihat progress order dalam tampilan kalender.', actions: ['view'] },
      { key: 'progress_snapshot.products', label: 'Product Snapshot', description: 'Lihat progress order dalam tampilan product snapshot.', actions: ['view'] },
      { key: 'production_planning', label: 'Production Planning', description: 'Pintu masuk halaman production planning Arkline.', actions: ['view'] },
      { key: 'production_planning.production_orders', label: 'Production Orders', codePrefix: 'arkline.production_orders', description: 'Kelola garment purchase order dan planning produksi.', actions: ['view', 'add', 'edit', 'delete', 'print'] },
      { key: 'production_planning.material_fulfillment', label: 'Material Fulfillment', codePrefix: 'arkline.material_fulfillment', description: 'Kelola kebutuhan dan pemenuhan material produksi.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'financial_management', label: 'Financial Management', description: 'Pintu masuk halaman financial management Arkline.', actions: ['view'] },
      { key: 'financial_management.payment_submission', label: 'Payment Submission', description: 'Kelola submission pembayaran terhadap PO/material.', actions: ['view', 'add', 'edit'] },
      { key: 'financial_management.live_reporting', label: 'Live Reporting', description: 'Akses mobile live entry dan history Arkline.', actions: ['view', 'add', 'edit'] },
      { key: 'financial_management.reporting', label: 'Financial Reporting', description: 'Lihat reporting finansial Arkline.', actions: ['view'] },
    ],
  },
]

function buildPermissionDefinitions() {
  return BASE_PERMISSION_GROUPS.flatMap((group) =>
    group.items.flatMap((item) => {
      const codePrefix = item.codePrefix || `${group.key}.${item.key}`
      return item.actions.map((action) => ({
        groupKey: group.key,
        groupLabel: group.label,
        itemKey: item.key,
        itemLabel: item.label,
        action,
        code: `${codePrefix}.${action}`,
      }))
    })
  )
}

export const PERMISSION_DEFINITIONS = buildPermissionDefinitions()
const PERMISSION_DEFINITION_MAP = new Map(PERMISSION_DEFINITIONS.map((item) => [item.code, item]))
const PERMISSION_CODE_SET = new Set(PERMISSION_DEFINITIONS.map((item) => item.code))
const INDEPENDENT_ACTION_PREFIXES = new Set(['inbound.receiving', 'inbound.unload'])
const INBOUND_ACCESS_CODES = [
  'inbound.receiving.view',
  'inbound.receiving.add',
  'inbound.receiving.edit',
  'inbound.unload.view',
  'inbound.unload.add',
  'inbound.unload.edit',
]
const STORAGE_ACCESS_CODES = [
  'storage.location.current_stock.view',
  'storage.location.current_stock.add',
  'storage.location.current_stock.edit',
  'storage.location.queue_area.storage_queue.view',
  'storage.location.queue_area.storage_queue.edit',
  'storage.location.queue_area.shelving_queue.view',
  'storage.location.queue_area.shelving_queue.edit',
  'storage.location.temp_area.temp_sales.view',
  'storage.location.temp_area.temp_sales.edit',
  'storage.location.temp_area.temp_retur_keeping.view',
  'storage.location.temp_area.temp_retur_keeping.edit',
  'storage.location.product_loans.view',
  'storage.location.product_loans.edit',
  'storage.location.packaging_supplier.view',
  'storage.location.reject_storage.view',
  'storage.location.reject_storage.add',
  'storage.location.reject_storage.edit',
  'storage.location.reject_storage.print',
  'storage.shelving_upload.view',
  'storage.shelving_upload.add',
  'storage.shelving_upload.edit',
  'storage.history.pick_history.view',
  'storage.history.movement_history.view',
  'storage.product_directory.view',
  'storage.product_directory.add',
  'storage.product_directory.edit',
  'storage.location.view',
  'storage.location.add',
  'storage.location.edit',
  'storage.queue.view',
  'storage.queue.edit',
  'storage.pick_history.view',
]
const LEGACY_INBOUND_PERMISSION_MAP = {
  'inbound.overview.view': ['inbound.receiving.view', 'inbound.unload.view'],
  'inbound.detail.view': ['inbound.receiving.view', 'inbound.unload.view'],
  'inbound.new.view': ['inbound.receiving.view'],
  'inbound.new.add': ['inbound.receiving.add'],
  'inbound.edit.view': ['inbound.receiving.view'],
  'inbound.edit.edit': ['inbound.receiving.edit'],
  'inbound.qc.view': ['inbound.unload.view'],
}
const LEGACY_STORAGE_PERMISSION_MAP = {
  'storage.overview.view': [
    'storage.location.current_stock.view',
    'storage.location.queue_area.storage_queue.view',
    'storage.location.queue_area.shelving_queue.view',
    'storage.location.temp_area.temp_sales.view',
    'storage.location.temp_area.temp_retur_keeping.view',
    'storage.location.product_loans.view',
    'storage.location.packaging_supplier.view',
    'storage.location.reject_storage.view',
    'storage.shelving_upload.view',
    'storage.history.pick_history.view',
    'storage.history.movement_history.view',
    'storage.product_directory.view',
  ],
  'storage.search.view': ['storage.location.current_stock.view'],
  'storage.registry.view': [
    'storage.location.current_stock.view',
    'storage.location.queue_area.storage_queue.view',
    'storage.location.queue_area.shelving_queue.view',
  ],
  'storage.registry.add': [
    'storage.location.current_stock.add',
    'storage.location.queue_area.storage_queue.edit',
    'storage.location.queue_area.shelving_queue.edit',
  ],
  'storage.registry.edit': [
    'storage.location.current_stock.edit',
    'storage.location.queue_area.storage_queue.edit',
    'storage.location.queue_area.shelving_queue.edit',
  ],
  'storage.registry.delete': ['storage.location.current_stock.edit'],
  'storage.location.view': [
    'storage.location.current_stock.view',
    'storage.location.product_loans.view',
    'storage.location.packaging_supplier.view',
    'storage.location.reject_storage.view',
  ],
  'storage.location.add': [
    'storage.location.current_stock.add',
    'storage.location.reject_storage.add',
  ],
  'storage.location.edit': [
    'storage.location.current_stock.edit',
    'storage.location.product_loans.edit',
    'storage.location.temp_area.temp_sales.edit',
    'storage.location.temp_area.temp_retur_keeping.edit',
    'storage.location.reject_storage.edit',
  ],
  'storage.queue.view': [
    'storage.location.queue_area.storage_queue.view',
    'storage.location.queue_area.shelving_queue.view',
    'storage.location.temp_area.temp_sales.view',
    'storage.location.temp_area.temp_retur_keeping.view',
  ],
  'storage.queue.edit': [
    'storage.location.queue_area.storage_queue.edit',
    'storage.location.queue_area.shelving_queue.edit',
    'storage.location.temp_area.temp_sales.edit',
    'storage.location.temp_area.temp_retur_keeping.edit',
  ],
  'storage.pick_history.view': [
    'storage.history.pick_history.view',
    'storage.history.movement_history.view',
  ],
}

function labelizeAction(action) {
  if (action === 'view') return 'View'
  if (action === 'add') return 'Add'
  if (action === 'edit') return 'Edit'
  if (action === 'delete') return 'Delete'
  if (action === 'print') return 'Print'
  if (action === 'export') return 'Export'
  if (action === 'submit') return 'Submit'
  if (action === 'assign') return 'Assign'
  if (action === 'visible') return 'Show shortcut'
  return action.replaceAll('_', ' ')
}

function titleize(value) {
  return String(value || '')
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getPermissionCatalog() {
  return BASE_PERMISSION_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    items: [
      ...group.items
        .filter((item) => !item.hidden && !(group.key === 'arkline' && item.key === 'financial_management.live_reporting'))
        .map((item) => {
          const codePrefix = item.codePrefix || `${group.key}.${item.key}`
          return {
            key: item.key,
            label: item.label,
            description: item.description || '',
            visibilityOnly: Boolean(item.visibilityOnly),
            codePrefix,
            actions: item.actions.map((action) => ({
              key: action,
              label: labelizeAction(action),
              code: `${codePrefix}.${action}`,
            })),
          }
        }),
      ...(group.key === 'arkline'
        ? [
            {
              key: 'financial_management.reporting.live_reporting',
              label: 'Live Reporting',
              description: 'Akses mobile live entry dan history Arkline.',
              codePrefix: 'arkline.financial_management.live_reporting',
              actions: ['view', 'add', 'edit'].map((action) => ({
                key: action,
                label: labelizeAction(action),
                code: `arkline.financial_management.live_reporting.${action}`,
              })),
            },
          ]
        : []),
    ],
  }))
}

export function getPermissionSeedRows() {
  const definitionRows = PERMISSION_DEFINITIONS.map((item) => ({
    code: item.code,
    label: `${labelizeAction(item.action)} ${item.itemLabel}`,
    description: `${labelizeAction(item.action)} access for ${item.itemLabel} in ${item.groupLabel}.`,
  }))
  const legacyStorageRows = [
    ['storage.location.view', 'View Storage Location'],
    ['storage.location.add', 'Add Storage Location'],
    ['storage.location.edit', 'Edit Storage Location'],
    ['storage.queue.view', 'View Storage Queue'],
    ['storage.queue.edit', 'Edit Storage Queue'],
    ['storage.pick_history.view', 'View Pick History'],
  ].map(([code, label]) => ({
    code,
    label,
    description: `${label} compatibility permission for existing Storage database policies.`,
  }))

  return [...definitionRows, ...legacyStorageRows]
}

const DEFAULT_ROLE_BUNDLES = {
  guest: ['dashboard.home.view', 'myarklife.view'],
  hrga: [
    'dashboard.home.view',
    'myarklife.view',
    'hrga.home.view',
    'hrga.announcement.view',
    'hrga.announcement.add',
    'hrga.announcement.edit',
    'hrga.announcement.delete',
    'hrga.people.view',
    'hrga.people.edit',
    'hrga.public_request_links.view',
    'hrga.public_request_links.edit',
    'hrga.benefits.view',
    'hrga.penalty_points.view',
    'hrga.penalty_points.add',
    'hrga.penalty_points.edit',
    'hrga.penalty_points.delete',
  ],
  leader: ['dashboard.home.view', 'myarklife.view', 'inbound.unload.view'],
  mob_cs: [
    'dashboard.home.view',
    'myarklife.view',
    'inbound.unload.view',
    'storage.shelving_upload.view',
    'storage.shelving_upload.add',
    'storage.shelving_upload.edit',
  ],
  oi_cs: [
    'dashboard.home.view',
    'myarklife.view',
    'inbound.unload.view',
    'storage.shelving_upload.view',
    'storage.shelving_upload.add',
    'storage.shelving_upload.edit',
  ],
  arkline_cs: [
    'dashboard.home.view',
    'myarklife.view',
    'storage.shelving_upload.view',
    'storage.shelving_upload.add',
    'storage.shelving_upload.edit',
  ],
  warehouse_leader: [
    'dashboard.home.view',
    'myarklife.view',
    'dashboard.operations_calendar.view',
    'storage.location.view',
    'storage.queue.view',
    'storage.pick_history.view',
    'storage.product_directory.view',
    'storage.shelving_upload.view',
    'storage.shelving_upload.add',
    'storage.shelving_upload.edit',
    'inbound.receiving.view',
    'inbound.unload.view',
    'packing.overview.view',
    'qc.summary.view',
    'hrga.penalty_points.view',
    'hrga.penalty_points.add',
  ],
  packing_coordinator: [
    'dashboard.home.view',
    'myarklife.view',
    'dashboard.operations_calendar.view',
    'packing.overview.view',
    'packing.receiving.view',
    'packing.receiving.add',
    'packing.receiving.edit',
    'packing.size_breakdown.view',
    'packing.size_breakdown.edit',
    'storage.restock_submit.view',
    'storage.restock_submit.add',
    'storage.restock_submit.edit',
  ],
  packing_staff: [
    'dashboard.home.view',
    'myarklife.view',
    'packing.overview.view',
    'packing.receiving.view',
    'packing.receiving.add',
    'packing.receiving.edit',
    'packing.size_breakdown.view',
    'packing.size_breakdown.edit',
    'storage.restock_submit.view',
    'storage.restock_submit.add',
    'storage.restock_submit.edit',
  ],
  qc_coordinator: [
    'dashboard.home.view',
    'myarklife.view',
    'dashboard.operations_calendar.view',
    'storage.location.view',
    'qc.summary.view',
    'qc.receiving.view',
    'qc.receiving.add',
    'qc.receiving.edit',
    'qc.receiving.delete',
    'qc.grading_task.view',
    'qc.grading_task.add',
    'qc.grading_task.edit',
    'qc.confirmation.view',
    'qc.confirmation.add',
    'qc.confirmation.edit',
    'qc.retur_report.view',
    'qc.retur_report.add',
    'qc.retur_report.edit',
  ],
  qc_staff: [
    'dashboard.home.view',
    'myarklife.view',
    'qc.receiving.view',
    'qc.receiving.add',
    'qc.receiving.edit',
    'qc.grading_task.view',
    'qc.grading_task.add',
    'qc.grading_task.edit',
    'qc.confirmation.view',
    'qc.confirmation.add',
    'qc.confirmation.edit',
    'qc.retur_report.view',
    'qc.retur_report.add',
    'qc.retur_report.edit',
  ],
  qc_inspector: [
    'dashboard.home.view',
    'myarklife.view',
    'qc.grading_task.view',
    'qc.grading_task.add',
    'qc.grading_task.edit',
  ],
  storage_coordinator: [
    'dashboard.home.view',
    'myarklife.view',
    'dashboard.operations_calendar.view',
    'storage.location.view',
    'storage.location.add',
    'storage.location.edit',
    'storage.shelving_upload.view',
    'storage.shelving_upload.add',
    'storage.shelving_upload.edit',
    'storage.queue.view',
    'storage.queue.edit',
    'storage.pick_history.view',
    'storage.product_directory.view',
    'storage.product_directory.add',
    'storage.product_directory.edit',
    'storage.restock_instruction.view',
    'storage.restock_submit.view',
    'storage.restock_submit.add',
    'storage.restock_submit.edit',
    'storage.restock_picker.view',
    'storage.restock_picker.edit',
  ],
  storage_staff: [
    'dashboard.home.view',
    'myarklife.view',
    'storage.location.view',
    'storage.location.add',
    'storage.location.edit',
    'storage.queue.view',
    'storage.queue.edit',
    'storage.pick_history.view',
    'storage.product_directory.view',
    'storage.product_directory.add',
    'storage.product_directory.edit',
    'storage.restock_instruction.view',
    'storage.restock_submit.view',
    'storage.restock_submit.add',
    'storage.restock_submit.edit',
    'storage.restock_picker.view',
    'storage.restock_picker.edit',
  ],
  inbound_coordinator: [
    'dashboard.home.view',
    'myarklife.view',
    'dashboard.operations_calendar.view',
    'inbound.receiving.view',
    'inbound.receiving.add',
    'inbound.receiving.edit',
    'inbound.unload.view',
    'inbound.unload.add',
    'inbound.unload.edit',
  ],
  inbound_staff: [
    'dashboard.home.view',
    'myarklife.view',
    'inbound.receiving.view',
    'inbound.receiving.edit',
    'inbound.unload.view',
    'inbound.unload.add',
  ],
  arkline_staff: [
    'dashboard.home.view',
    'myarklife.view',
    'arkline.overview.view',
    'arkline.progress_snapshot.view',
    'arkline.progress_snapshot.products.view',
  ],
  arkline_merchandiser: [
    'dashboard.home.view',
    'myarklife.view',
    'arkline.overview.view',
    'arkline.directory.view',
    'arkline.directory.products.view',
    'arkline.directory.products.add',
    'arkline.directory.products.edit',
    'arkline.directory.bom.view',
    'arkline.directory.bom.add',
    'arkline.directory.bom.edit',
    'arkline.directory.materials.view',
    'arkline.directory.materials.add',
    'arkline.directory.materials.edit',
    'arkline.directory.suppliers.view',
    'arkline.directory.suppliers.add',
    'arkline.directory.suppliers.edit',
    'arkline.directory.purchase_orders.view',
    'arkline.directory.purchase_orders.print',
    'arkline.progress_snapshot.view',
    'arkline.progress_snapshot.kanban.view',
    'arkline.progress_snapshot.kanban.add',
    'arkline.progress_snapshot.kanban.edit',
    'arkline.progress_snapshot.calendar.view',
    'arkline.progress_snapshot.products.view',
    'arkline.production_planning.view',
    'arkline.production_orders.view',
    'arkline.production_orders.add',
    'arkline.production_orders.edit',
    'arkline.production_orders.delete',
    'arkline.production_orders.print',
    'arkline.material_fulfillment.view',
    'arkline.material_fulfillment.add',
    'arkline.material_fulfillment.edit',
    'arkline.material_fulfillment.delete',
    'arkline.financial_management.view',
    'arkline.financial_management.payment_submission.view',
    'arkline.financial_management.payment_submission.add',
    'arkline.financial_management.payment_submission.edit',
    'arkline.financial_management.live_reporting.view',
    'arkline.financial_management.live_reporting.add',
    'arkline.financial_management.live_reporting.edit',
    'arkline.financial_management.reporting.view',
  ],
  arkline_host: [
    'dashboard.home.view',
    'myarklife.view',
    'arkline.overview.view',
    'arkline.directory.view',
    'arkline.directory.products.view',
    'arkline.directory.bom.view',
    'arkline.directory.materials.view',
    'arkline.directory.suppliers.view',
    'arkline.directory.purchase_orders.view',
    'arkline.progress_snapshot.view',
    'arkline.progress_snapshot.kanban.view',
    'arkline.progress_snapshot.calendar.view',
    'arkline.progress_snapshot.products.view',
    'arkline.financial_management.live_reporting.view',
    'arkline.financial_management.live_reporting.add',
    'arkline.financial_management.live_reporting.edit',
  ],
}
const UNIVERSAL_DEFAULT_PERMISSIONS = ['delivery_report.view']

export function getDefaultPermissionsForRole(role) {
  return [...new Set(
    Array.from(expandImpliedPermissions([...(DEFAULT_ROLE_BUNDLES[role] || []), ...UNIVERSAL_DEFAULT_PERMISSIONS]))
      .filter((code) => PERMISSION_CODE_SET.has(code))
  )]
}

export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase()
  const mapped = LEGACY_ROLE_MAP[normalized] || normalized
  if (OFFICIAL_ROLE_VALUES.includes(mapped)) {
    return mapped
  }
  return 'guest'
}

export function resolveRole(role = '', isAdmin = false) {
  if (isAdmin) return 'admin'
  return normalizeRole(role)
}

export function hasPermission(permissions = [], code = '', isAdmin = false) {
  if (isAdmin) return true
  return expandImpliedPermissions(permissions).has(code)
}

export function hasAnyPermission(permissions = [], codes = [], isAdmin = false) {
  if (isAdmin) return true
  const expanded = expandImpliedPermissions(permissions)
  return codes.some((code) => expanded.has(code))
}

export function canAccessInbound(permissions = [], isAdmin = false) {
  return hasAnyPermission(permissions, INBOUND_ACCESS_CODES, isAdmin)
}

export function getInboundLandingPath(role = '', permissions = [], isAdmin = false) {
  const resolvedRole = resolveRole(role, isAdmin)
  const canViewReceiving = hasPermission(permissions, 'inbound.receiving.view', isAdmin)
  const canAddReceiving = hasPermission(permissions, 'inbound.receiving.add', isAdmin)
  const canInputReceiving = hasPermission(permissions, 'inbound.receiving.edit', isAdmin)
  const canViewUnload = hasPermission(permissions, 'inbound.unload.view', isAdmin)
  const canManageUnload = hasAnyPermission(permissions, ['inbound.unload.add', 'inbound.unload.edit'], isAdmin)
  const canOnlyViewUnload = canViewUnload && !canManageUnload && !canViewReceiving

  if (resolvedRole === 'inbound_staff') {
    if (canViewReceiving || canInputReceiving || canViewUnload || canManageUnload) return '/dashboard/inbound/receiving'
    return ''
  }

  if (resolvedRole === 'leader') {
    if (canViewUnload || canViewReceiving) return '/dashboard/inbound'
    return ''
  }

  if (canOnlyViewUnload) return '/dashboard/inbound'

  if (canViewReceiving) return '/dashboard/inbound/receiving'
  if (canAddReceiving) return '/dashboard/inbound/new'
  if (canViewUnload) return '/dashboard/inbound/unload'
  if (canManageUnload) return '/mobile/inbound/unload'
  return ''
}

export function expandImpliedPermissions(permissions = []) {
  const expanded = new Set(
    (permissions || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )

  for (const [legacyCode, mappedCodes] of Object.entries(LEGACY_INBOUND_PERMISSION_MAP)) {
    if (!expanded.has(legacyCode)) continue
    expanded.delete(legacyCode)
    mappedCodes.forEach((code) => expanded.add(code))
  }

  const hasGranularStoragePermissions = Array.from(expanded).some((code) => (
    (code.startsWith('storage.location.') && !['storage.location.view', 'storage.location.add', 'storage.location.edit'].includes(code)) ||
    code.startsWith('storage.history.')
  ))

  if (!hasGranularStoragePermissions) {
    for (const [legacyCode, mappedCodes] of Object.entries(LEGACY_STORAGE_PERMISSION_MAP)) {
      if (!expanded.has(legacyCode)) continue
      expanded.delete(legacyCode)
      mappedCodes.forEach((code) => expanded.add(code))
    }
  }

  for (const code of Array.from(expanded)) {
    const parts = code.split('.')
    const action = parts.at(-1)
    const prefix = parts.slice(0, -1).join('.')

    if (
      ['add', 'edit', 'delete', 'print', 'export', 'submit', 'assign'].includes(action) &&
      !INDEPENDENT_ACTION_PREFIXES.has(prefix)
    ) {
      expanded.add(`${prefix}.view`)
    }
  }

  return expanded
}

export function getStoragePermissionCompatibilityCodes(permissions = []) {
  const codes = expandImpliedPermissions(permissions)
  const compatibilityCodes = new Set()
  const hasAny = (prefixes, action) => prefixes.some((prefix) => codes.has(`${prefix}.${action}`))

  const currentStock = 'storage.location.current_stock'
  const queuePrefixes = [
    'storage.location.queue_area.storage_queue',
    'storage.location.queue_area.shelving_queue',
    'storage.location.temp_area.temp_sales',
    'storage.location.temp_area.temp_retur_keeping',
  ]
  const locationPrefixes = [
    currentStock,
    'storage.location.product_loans',
    'storage.location.packaging_supplier',
    'storage.location.reject_storage',
  ]

  if (hasAny(locationPrefixes, 'view')) compatibilityCodes.add('storage.location.view')
  if (hasAny([currentStock, 'storage.location.reject_storage'], 'add')) compatibilityCodes.add('storage.location.add')
  if (hasAny([
    currentStock,
    'storage.location.product_loans',
    'storage.location.reject_storage',
    ...queuePrefixes.slice(2),
  ], 'edit')) compatibilityCodes.add('storage.location.edit')
  if (hasAny(queuePrefixes, 'view')) compatibilityCodes.add('storage.queue.view')
  if (hasAny(queuePrefixes, 'edit')) compatibilityCodes.add('storage.queue.edit')
  if (codes.has('storage.history.pick_history.view') || codes.has('storage.history.movement_history.view')) {
    compatibilityCodes.add('storage.pick_history.view')
  }

  return Array.from(compatibilityCodes)
}

function buildFeatureAccess(codePrefix, permissions, isAdmin) {
  return {
    view: hasPermission(permissions, `${codePrefix}.view`, isAdmin),
    add: hasPermission(permissions, `${codePrefix}.add`, isAdmin),
    edit: hasPermission(permissions, `${codePrefix}.edit`, isAdmin),
    delete: hasPermission(permissions, `${codePrefix}.delete`, isAdmin),
    print: hasPermission(permissions, `${codePrefix}.print`, isAdmin),
    export: hasPermission(permissions, `${codePrefix}.export`, isAdmin),
    submit: hasPermission(permissions, `${codePrefix}.submit`, isAdmin),
    assign: hasPermission(permissions, `${codePrefix}.assign`, isAdmin),
  }
}

export function canAccessPeopleManagement(permissions = [], isAdmin = false) {
  return hasPermission(permissions, 'hrga.home.view', isAdmin)
}

export function getArklineFeatureAccess(role, permissions = [], isAdmin = false) {
  const resolvedRole = resolveRole(role, isAdmin)
  const canReviewReimbursement = resolvedRole === 'hrga' || resolvedRole === 'leader'

  if (isAdmin || resolvedRole === 'admin') {
    return {
      menu: true,
      menuHref: '/dashboard/arkline',
      overview: true,
      directory: true,
      directoryBom: true,
      directoryCreate: true,
      directoryProducts: true,
      directoryProductsCreate: true,
      directoryProductsEdit: true,
      directoryProductsDelete: true,
      directoryMaterials: true,
      directoryMaterialsCreate: true,
      directoryMaterialsEdit: true,
      directoryMaterialsDelete: true,
      directorySuppliers: true,
      directorySuppliersCreate: true,
      directorySuppliersEdit: true,
      directoryPurchaseOrders: true,
      directoryPurchaseOrdersPrint: true,
      progressOverview: true,
      progressKanban: true,
      progressKanbanAdd: true,
      progressKanbanEdit: true,
      progressCalendar: true,
      progressProducts: true,
      productionPlanning: true,
      productionOrdersView: true,
      productionOrdersAdd: true,
      productionOrdersEdit: true,
      productionOrdersDelete: true,
      productionOrdersPrint: true,
      materialFulfillmentView: true,
      materialFulfillmentAdd: true,
      materialFulfillmentEdit: true,
      materialFulfillmentDelete: true,
      financialManagement: true,
      financialManagementHref: '/dashboard/arkline/financial-management',
      financialManagementPaymentSubmissionView: true,
      financialManagementPaymentSubmissionAdd: true,
      financialManagementPaymentSubmissionEdit: true,
      financialManagementLiveReportingView: true,
      financialManagementLiveReportingAdd: true,
      financialManagementLiveReportingEdit: true,
      financialReporting: true,
      reimbursementView: true,
      reimbursementSubmit: true,
      reimbursementEdit: true,
      reimbursementApprove: true,
      reimbursementPay: true,
    }
  }

  if (resolvedRole === 'external') {
    return {
      menu: true,
      menuHref: '/dashboard/arkline/progress-overview',
      overview: false,
      directory: false,
      directoryBom: false,
      directoryCreate: false,
      directoryProducts: false,
      directoryProductsCreate: false,
      directoryProductsEdit: false,
      directoryProductsDelete: false,
      directoryMaterials: false,
      directoryMaterialsCreate: false,
      directoryMaterialsEdit: false,
      directoryMaterialsDelete: false,
      directorySuppliers: false,
      directorySuppliersCreate: false,
      directorySuppliersEdit: false,
      directoryPurchaseOrders: false,
      directoryPurchaseOrdersPrint: false,
      progressOverview: true,
      progressKanban: true,
      progressKanbanAdd: false,
      progressKanbanEdit: false,
      progressCalendar: false,
      progressProducts: false,
      productionPlanning: false,
      productionOrdersView: false,
      productionOrdersAdd: false,
      productionOrdersEdit: false,
      productionOrdersDelete: false,
      productionOrdersPrint: false,
      materialFulfillmentView: false,
      materialFulfillmentAdd: false,
      materialFulfillmentEdit: false,
      materialFulfillmentDelete: false,
      financialManagement: false,
      financialManagementHref: '/dashboard/arkline/financial-management',
      financialManagementPaymentSubmissionView: false,
      financialManagementPaymentSubmissionAdd: false,
      financialManagementPaymentSubmissionEdit: false,
      financialManagementLiveReportingView: false,
      financialManagementLiveReportingAdd: false,
      financialManagementLiveReportingEdit: false,
      financialReporting: false,
      reimbursementView: false,
      reimbursementSubmit: false,
      reimbursementEdit: false,
      reimbursementApprove: false,
      reimbursementPay: false,
    }
  }

  const directoryHome = buildFeatureAccess('arkline.directory', permissions, isAdmin)
  const directoryProducts = buildFeatureAccess('arkline.directory.products', permissions, isAdmin)
  const directoryBom = buildFeatureAccess('arkline.directory.bom', permissions, isAdmin)
  const directoryMaterials = buildFeatureAccess('arkline.directory.materials', permissions, isAdmin)
  const directorySuppliers = buildFeatureAccess('arkline.directory.suppliers', permissions, isAdmin)
  const directoryPurchaseOrders = buildFeatureAccess('arkline.directory.purchase_orders', permissions, isAdmin)
  const progressHome = buildFeatureAccess('arkline.progress_snapshot', permissions, isAdmin)
  const progressKanban = buildFeatureAccess('arkline.progress_snapshot.kanban', permissions, isAdmin)
  const progressCalendar = buildFeatureAccess('arkline.progress_snapshot.calendar', permissions, isAdmin)
  const progressProducts = buildFeatureAccess('arkline.progress_snapshot.products', permissions, isAdmin)
  const productionPlanning = buildFeatureAccess('arkline.production_planning', permissions, isAdmin)
  const productionOrders = buildFeatureAccess('arkline.production_orders', permissions, isAdmin)
  const materialFulfillment = buildFeatureAccess('arkline.material_fulfillment', permissions, isAdmin)
  const financialManagement = buildFeatureAccess('arkline.financial_management', permissions, isAdmin)
  const paymentSubmission = buildFeatureAccess('arkline.financial_management.payment_submission', permissions, isAdmin)
  const liveReporting = buildFeatureAccess('arkline.financial_management.live_reporting', permissions, isAdmin)
  const financialReporting = buildFeatureAccess('arkline.financial_management.reporting', permissions, isAdmin)
  const myArklife = hasPermission(permissions, 'myarklife.view', isAdmin)
  const overview = hasPermission(permissions, 'arkline.overview.view', isAdmin)
  const menu =
    overview ||
    directoryHome.view ||
    directoryProducts.view ||
    directoryBom.view ||
    directoryMaterials.view ||
    directorySuppliers.view ||
    directoryPurchaseOrders.view ||
    progressHome.view ||
    progressKanban.view ||
    progressCalendar.view ||
    progressProducts.view ||
    productionPlanning.view ||
    productionOrders.view ||
    materialFulfillment.view ||
    financialManagement.view ||
    paymentSubmission.view ||
    liveReporting.view ||
    financialReporting.view

  let menuHref = '/dashboard'
  if (overview) menuHref = '/dashboard/arkline'
  else if (directoryHome.view || directoryProducts.view) menuHref = '/dashboard/arkline/directory'
  else if (directoryMaterials.view) menuHref = '/dashboard/arkline/directory/materials'
  else if (directoryBom.view) menuHref = '/dashboard/arkline/directory/bom'
  else if (directorySuppliers.view) menuHref = '/dashboard/arkline/directory/suppliers'
  else if (directoryPurchaseOrders.view) menuHref = '/dashboard/arkline/directory/purchase-orders'
  else if (progressHome.view || progressKanban.view || progressCalendar.view || progressProducts.view) menuHref = '/dashboard/arkline/progress-overview'
  else if (productionPlanning.view || productionOrders.view || materialFulfillment.view) menuHref = '/dashboard/arkline/production-planning'

  let financialManagementHref = '/dashboard/arkline/financial-management'
  if (financialManagement.view || paymentSubmission.view) financialManagementHref = '/dashboard/arkline/financial-management'
  else if (liveReporting.view) financialManagementHref = '/dashboard/arkline/financial-management/live-reporting'
  else if (financialReporting.view) financialManagementHref = '/dashboard/arkline/financial-management/reporting'

  if (menuHref === '/dashboard' && (financialManagement.view || paymentSubmission.view || liveReporting.view || financialReporting.view)) {
    menuHref = financialManagementHref
  }

  return {
    menu,
    menuHref,
    overview,
    directory: directoryHome.view || directoryProducts.view || directoryBom.view || directoryMaterials.view || directorySuppliers.view || directoryPurchaseOrders.view,
    directoryBom: directoryBom.view,
    directoryCreate: directoryProducts.add || directoryProducts.edit,
    directoryProducts: directoryProducts.view,
    directoryProductsCreate: directoryProducts.add,
    directoryProductsEdit: directoryProducts.edit,
    directoryProductsDelete: directoryProducts.delete,
    directoryMaterials: directoryMaterials.view,
    directoryMaterialsCreate: directoryMaterials.add,
    directoryMaterialsEdit: directoryMaterials.edit,
    directoryMaterialsDelete: directoryMaterials.delete,
    directorySuppliers: directorySuppliers.view,
    directorySuppliersCreate: directorySuppliers.add,
    directorySuppliersEdit: directorySuppliers.edit,
    directoryPurchaseOrders: directoryPurchaseOrders.view,
    directoryPurchaseOrdersPrint: directoryPurchaseOrders.print,
    progressOverview: progressHome.view || progressKanban.view || progressCalendar.view || progressProducts.view,
    progressKanban: progressKanban.view,
    progressKanbanAdd: progressKanban.add,
    progressKanbanEdit: progressKanban.edit,
    progressCalendar: progressCalendar.view,
    progressProducts: progressProducts.view,
    productionPlanning: productionPlanning.view || productionOrders.view || materialFulfillment.view,
    productionOrdersView: productionOrders.view,
    productionOrdersAdd: productionOrders.add,
    productionOrdersEdit: productionOrders.edit,
    productionOrdersDelete: productionOrders.delete,
    productionOrdersPrint: productionOrders.print,
    materialFulfillmentView: materialFulfillment.view,
    materialFulfillmentAdd: materialFulfillment.add,
    materialFulfillmentEdit: materialFulfillment.edit,
    materialFulfillmentDelete: materialFulfillment.delete,
    financialManagement: financialManagement.view || paymentSubmission.view || liveReporting.view || financialReporting.view,
    financialManagementHref,
    financialManagementPaymentSubmissionView: paymentSubmission.view,
    financialManagementPaymentSubmissionAdd: paymentSubmission.add,
    financialManagementPaymentSubmissionEdit: paymentSubmission.edit,
    financialManagementLiveReportingView: liveReporting.view,
    financialManagementLiveReportingAdd: liveReporting.add,
    financialManagementLiveReportingEdit: liveReporting.edit,
    financialReporting: financialReporting.view,
    reimbursementView: myArklife || canReviewReimbursement,
    reimbursementSubmit: myArklife,
    reimbursementEdit: myArklife,
    reimbursementApprove: canReviewReimbursement,
    reimbursementPay: canReviewReimbursement,
  }
}

export function getQcFeatureAccess(permissions = [], isAdmin = false, role = '') {
  if (isAdmin || role === 'admin') {
    return {
      menu: true,
      menuHref: '/dashboard/qc',
      dashboard: true,
      receiving: true,
      inspectionTask: true,
      confirmation: true,
      retur: true,
      inspectionTaskOnly: false,
    }
  }

  const dashboard = hasPermission(permissions, 'qc.summary.view', isAdmin)
  const receiving = hasPermission(permissions, 'qc.receiving.view', isAdmin)
  const inspectionTask = hasPermission(permissions, 'qc.grading_task.view', isAdmin)
  const confirmation = hasPermission(permissions, 'qc.confirmation.view', isAdmin)
  const retur = hasPermission(permissions, 'qc.retur_report.view', isAdmin)
  const menu = dashboard || receiving || inspectionTask || confirmation || retur
  const inspectionTaskOnly = inspectionTask && !dashboard && !receiving && !confirmation && !retur

  let menuHref = '/dashboard'
  if (dashboard) menuHref = '/dashboard/qc'
  else if (receiving) menuHref = '/dashboard/qc/receiving'
  else if (inspectionTask) menuHref = '/mobile/qc/inspection-task'
  else if (confirmation) menuHref = '/dashboard/qc/confirmation'
  else if (retur) menuHref = '/dashboard/qc/retur-report'

  return { menu, menuHref, dashboard, receiving, inspectionTask, confirmation, retur, inspectionTaskOnly }
}

export function getStorageFeatureAccess(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') {
    return {
      menu: true,
      menuHref: '/dashboard/storage/overview',
      location: true,
      currentStock: true,
      locationAdd: true,
      locationEdit: true,
      queue: true,
      storageQueue: true,
      storageQueueEdit: true,
      shelvingQueue: true,
      shelvingQueueEdit: true,
      queueEdit: true,
      tempSales: true,
      tempSalesEdit: true,
      tempReturKeeping: true,
      tempReturKeepingEdit: true,
      productLoans: true,
      productLoansEdit: true,
      packagingSupplier: true,
      rejectStorageView: true,
      rejectStorageAdd: true,
      rejectStorageEdit: true,
      rejectStoragePrint: true,
      pickHistory: true,
      movementHistory: true,
      productDirectory: true,
      productDirectoryAdd: true,
      productDirectoryEdit: true,
      shelvingUpload: true,
      shelvingUploadAdd: true,
      shelvingUploadEdit: true,
      warehouseMap: true,
      brandLookup: true,
      restockSubmit: true,
      restockPicker: true,
    }
  }

  const resolvedRole = String(role || '').trim().toLowerCase()
  const currentStock = hasPermission(permissions, 'storage.location.current_stock.view', isAdmin)
  const locationAdd = hasPermission(permissions, 'storage.location.current_stock.add', isAdmin)
  const locationEdit = hasPermission(permissions, 'storage.location.current_stock.edit', isAdmin)
  const storageQueue = hasPermission(permissions, 'storage.location.queue_area.storage_queue.view', isAdmin)
  const storageQueueEdit = hasPermission(permissions, 'storage.location.queue_area.storage_queue.edit', isAdmin)
  const shelvingQueue = hasPermission(permissions, 'storage.location.queue_area.shelving_queue.view', isAdmin)
  const shelvingQueueEdit = hasPermission(permissions, 'storage.location.queue_area.shelving_queue.edit', isAdmin)
  const tempSales = hasPermission(permissions, 'storage.location.temp_area.temp_sales.view', isAdmin)
  const tempSalesEdit = hasPermission(permissions, 'storage.location.temp_area.temp_sales.edit', isAdmin)
  const tempReturKeeping = hasPermission(permissions, 'storage.location.temp_area.temp_retur_keeping.view', isAdmin)
  const tempReturKeepingEdit = hasPermission(permissions, 'storage.location.temp_area.temp_retur_keeping.edit', isAdmin)
  const productLoans = hasPermission(permissions, 'storage.location.product_loans.view', isAdmin)
  const productLoansEdit = hasPermission(permissions, 'storage.location.product_loans.edit', isAdmin)
  const packagingSupplier = hasPermission(permissions, 'storage.location.packaging_supplier.view', isAdmin)
  const rejectStorageView = hasPermission(permissions, 'storage.location.reject_storage.view', isAdmin)
  const rejectStorageAdd = hasPermission(permissions, 'storage.location.reject_storage.add', isAdmin)
  const rejectStorageEdit = hasPermission(permissions, 'storage.location.reject_storage.edit', isAdmin)
  const rejectStoragePrint = hasPermission(permissions, 'storage.location.reject_storage.print', isAdmin)
  const location = currentStock || storageQueue || shelvingQueue || tempSales || tempReturKeeping || productLoans || packagingSupplier || rejectStorageView
  const queue = storageQueue || shelvingQueue || tempSales || tempReturKeeping
  const queueEdit = storageQueueEdit || shelvingQueueEdit || tempSalesEdit || tempReturKeepingEdit
  const pickHistory = hasPermission(permissions, 'storage.history.pick_history.view', isAdmin)
  const movementHistory = hasPermission(permissions, 'storage.history.movement_history.view', isAdmin)
  const productDirectory = hasPermission(permissions, 'storage.product_directory.view', isAdmin)
  const productDirectoryAdd = hasPermission(permissions, 'storage.product_directory.add', isAdmin)
  const productDirectoryEdit = hasPermission(permissions, 'storage.product_directory.edit', isAdmin)
  const shelvingUpload = hasPermission(permissions, 'storage.shelving_upload.view', isAdmin)
  const shelvingUploadAdd = hasPermission(permissions, 'storage.shelving_upload.add', isAdmin)
  const shelvingUploadEdit = hasPermission(permissions, 'storage.shelving_upload.edit', isAdmin)
  const restockInstruction = hasPermission(permissions, 'storage.restock_instruction.view', isAdmin)
  const restockSubmit = hasPermission(permissions, 'storage.restock_submit.view', isAdmin)
  let restockPicker = hasPermission(permissions, 'storage.restock_picker.view', isAdmin)
  if ((resolvedRole === 'packing_staff' || resolvedRole === 'packing_coordinator') &&
    !hasPermission(permissions, DASHBOARD_SHORTCUT_CODES.stockReplenishment, isAdmin)) {
    restockPicker = false
  }
  const menu = location || shelvingUpload || queue || pickHistory || movementHistory || productDirectory

  let menuHref = '/dashboard'
  if (menu) menuHref = '/dashboard/storage/overview'

  return {
    menu,
    menuHref,
    location,
    locationAdd,
    locationEdit,
    queue,
    queueEdit,
    storageQueue,
    storageQueueEdit,
    shelvingQueue,
    shelvingQueueEdit,
    tempSales,
    tempSalesEdit,
    tempReturKeeping,
    tempReturKeepingEdit,
    pickHistory,
    productDirectory,
    productDirectoryAdd,
    productDirectoryEdit,
    shelvingUpload,
    shelvingUploadAdd,
    shelvingUploadEdit,
    currentStock,
    productLoans,
    productLoansEdit,
    packagingSupplier,
    rejectStorageView,
    rejectStorageAdd,
    rejectStorageEdit,
    rejectStoragePrint,
    movementHistory,
    warehouseMap: menu && resolvedRole !== 'qc_coordinator',
    brandLookup: menu && resolvedRole !== 'qc_coordinator',
    restockInstruction,
    restockSubmit,
    restockPicker,
  }
}

export function canAccessOperationsCalendar(role, permissions = [], isAdmin = false) {
  const resolvedRole = resolveRole(role, isAdmin)
  if (isAdmin || resolvedRole === 'admin') return true
  if (hasPermission(permissions, 'dashboard.operations_calendar.view', false)) return true
  if (resolvedRole === 'warehouse_leader') return true
  return String(resolvedRole || '').endsWith('_coordinator')
}

export function getDashboardShortcutAccessCodes(role, permissions = [], isAdmin = false) {
  if (isAdmin || resolveRole(role, isAdmin) === 'admin') return Object.values(DASHBOARD_SHORTCUT_CODES)

  const available = new Set()
  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)

  if (hasAnyPermission(permissions, ['storage.location.current_stock.view', 'arkline.directory.products.view'])) {
    available.add(DASHBOARD_SHORTCUT_CODES.search)
  }
  if (storageAccess.restockSubmit) available.add(DASHBOARD_SHORTCUT_CODES.restockRequest)
  if (storageAccess.restockPicker) available.add(DASHBOARD_SHORTCUT_CODES.stockReplenishment)
  if (storageAccess.productLoans) available.add(DASHBOARD_SHORTCUT_CODES.productLoanRequest)
  if (hasPermission(permissions, 'hrga.penalty_points.view')) available.add(DASHBOARD_SHORTCUT_CODES.penaltyPoints)
  if (hasPermission(permissions, 'delivery_report.view')) available.add(DASHBOARD_SHORTCUT_CODES.deliveryReport)
  if (canAccessOperationsCalendar(role, permissions)) available.add(DASHBOARD_SHORTCUT_CODES.operationsCalendar)
  if (hasPermission(permissions, 'myarklife.view')) available.add(DASHBOARD_SHORTCUT_CODES.myArklife)

  return Array.from(available)
}

export function getDashboardShortcutVisibilityCodes(role, permissions = [], isAdmin = false) {
  const availableCodes = getDashboardShortcutAccessCodes(role, permissions, isAdmin)
  if (isAdmin || resolveRole(role, isAdmin) === 'admin') return availableCodes

  const expandedPermissions = expandImpliedPermissions(permissions)
  if (!expandedPermissions.has(DASHBOARD_SHORTCUT_CONFIGURED_CODE)) return availableCodes

  return availableCodes.filter((code) => expandedPermissions.has(code))
}

export function getLandingPath(role, permissions = [], isAdmin = false) {
  const resolvedRole = resolveRole(role, isAdmin)
  if (isAdmin || resolvedRole === 'admin') return '/dashboard'
  if (resolvedRole === 'external') return '/dashboard/arkline/progress-overview'
  if (resolvedRole === 'inbound_coordinator' || resolvedRole === 'inbound_staff') return '/dashboard'
  if (hasPermission(permissions, 'dashboard.home.view', isAdmin)) return '/dashboard'

  const qcAccess = getQcFeatureAccess(permissions, isAdmin, role)
  if (qcAccess.menu) return qcAccess.menuHref
  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  if (storageAccess.menu) return storageAccess.menuHref
  const arklineAccess = getArklineFeatureAccess(role, permissions, isAdmin)
  if (arklineAccess.menu) return arklineAccess.menuHref
  if (canAccessPeopleManagement(permissions, isAdmin)) return '/dashboard/human-resources'
  const inboundLandingPath = getInboundLandingPath(role, permissions, isAdmin)
  if (inboundLandingPath) return inboundLandingPath
  if (hasPermission(permissions, 'packing.overview.view', isAdmin)) return '/dashboard/packing-list'
  if (hasPermission(permissions, 'myarklife.view', isAdmin)) return '/dashboard/myarklife'
  return '/dashboard'
}

export function getAllowedMenus(role, permissions = [], isAdmin = false) {
  const resolvedRole = resolveRole(role, isAdmin)

  if (isAdmin || resolvedRole === 'admin') {
    return {
      humanResources: true,
      humanResourcesHref: '/dashboard/human-resources',
      myArklife: true,
      myArklifeHref: '/dashboard/myarklife',
      arkline: true,
      arklineHref: '/dashboard/arkline',
      inbound: true,
      inboundHref: '/dashboard/inbound/receiving',
      qc: true,
      qcHref: '/dashboard/qc',
      qcInspectorOnly: false,
      packing: true,
      storage: true,
      storageHref: '/dashboard/storage/overview',
      masterData: true,
      userAccess: true,
    }
  }

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  const qcAccess = getQcFeatureAccess(permissions, isAdmin, role)
  const arklineAccess = getArklineFeatureAccess(role, permissions, isAdmin)
  const inboundHref = getInboundLandingPath(role, permissions, isAdmin)

  return {
    humanResources: canAccessPeopleManagement(permissions, isAdmin),
    humanResourcesHref: '/dashboard/human-resources',
    myArklife: hasPermission(permissions, 'myarklife.view', isAdmin),
    myArklifeHref: '/dashboard/myarklife',
    arkline: arklineAccess.menu,
    arklineHref: arklineAccess.menuHref,
    inbound: Boolean(inboundHref),
    inboundHref: inboundHref || '/dashboard',
    qc: qcAccess.menu,
    qcHref: qcAccess.menuHref,
    qcInspectorOnly: qcAccess.inspectionTaskOnly,
    packing: hasPermission(permissions, 'packing.overview.view', isAdmin),
    storage: storageAccess.menu,
    storageHref: storageAccess.menuHref,
    masterData: false,
    userAccess: false,
  }
}

const ROUTE_PERMISSION_MAP = [
  { matcher: (pathname) => pathname === '/dashboard', codes: ['dashboard.home.view'] },
  { matcher: (pathname) => pathname === '/operations-calendar' || pathname.startsWith('/operations-calendar?'), codes: ['dashboard.operations_calendar.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/profile'), codes: ['myarklife.view'] },
  { matcher: (pathname) => pathname === '/dashboard/myarklife' || pathname.startsWith('/dashboard/myarklife/'), codes: ['myarklife.view'] },
  { matcher: (pathname) => pathname === '/dashboard/human-resources' || pathname.startsWith('/dashboard/human-resources/'), codes: ['hrga.home.view'] },
  { matcher: (pathname) => pathname === '/dashboard/storage' || pathname.startsWith('/dashboard/storage?'), codes: STORAGE_ACCESS_CODES },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/search'), codes: ['storage.location.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/registry'), codes: ['storage.location.add', 'storage.location.edit'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/overview'), codes: STORAGE_ACCESS_CODES },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/daftar-barang'), codes: ['storage.product_directory.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/warehouse-map'), codes: STORAGE_ACCESS_CODES },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/restock-instruction'), codes: ['storage.restock_instruction.view', 'storage.restock_submit.view', 'storage.restock_picker.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/restock-request') || pathname === '/restock-request' || pathname.startsWith('/restock-request?'), codes: ['storage.restock_submit.view'] },
  { matcher: (pathname) => pathname === '/take-requests' || pathname.startsWith('/take-requests?'), codes: ['storage.restock_picker.view'] },
  { matcher: (pathname) => pathname === '/dashboard/qc' || pathname.startsWith('/dashboard/qc?'), codes: ['qc.summary.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/receiving') || pathname.startsWith('/mobile/qc/receiving'), codes: ['qc.receiving.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/inspection-task') || pathname.startsWith('/mobile/qc/inspection-task'), codes: ['qc.grading_task.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/confirmation'), codes: ['qc.confirmation.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/retur-report'), codes: ['qc.retur_report.view'] },
  { matcher: (pathname) => pathname === '/dashboard/inbound' || pathname.startsWith('/dashboard/inbound?'), codes: INBOUND_ACCESS_CODES },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/new'), codes: ['inbound.receiving.add'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/unload'), codes: ['inbound.unload.view', 'inbound.unload.add', 'inbound.unload.edit'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/receiving'), codes: INBOUND_ACCESS_CODES },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/qc'), codes: ['qc.receiving.view'] },
  { matcher: (pathname) => /^\/dashboard\/inbound\/[^/]+\/input/.test(pathname), codes: ['inbound.receiving.edit'] },
  { matcher: (pathname) => /^\/dashboard\/inbound\/[^/]+\/edit/.test(pathname), codes: ['inbound.receiving.edit'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/'), codes: ['inbound.receiving.view'] },
  { matcher: (pathname) => pathname.startsWith('/mobile/inbound/receiving'), codes: ['inbound.receiving.edit'] },
  { matcher: (pathname) => pathname.startsWith('/mobile/inbound/unload'), codes: ['inbound.unload.add', 'inbound.unload.edit'] },
  { matcher: (pathname) => pathname === '/mobile/inbound' || pathname.startsWith('/mobile/inbound?'), codes: INBOUND_ACCESS_CODES },
  { matcher: (pathname) => pathname === '/dashboard/packing-list' || pathname.startsWith('/dashboard/packing-list?'), codes: ['packing.overview.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/packing-list/receiving'), codes: ['packing.receiving.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/packing-list/size-breakdown'), codes: ['packing.size_breakdown.view'] },
  { matcher: (pathname) => pathname.startsWith('/mobile/packing-list/item-storing'), codes: ['packing.size_breakdown.view'] },
  { matcher: (pathname) => pathname === '/dashboard/delivery-report' || pathname.startsWith('/dashboard/delivery-report/') || pathname.startsWith('/dashboard/delivery-report?'), codes: ['delivery_report.view'] },
  { matcher: (pathname) => pathname === '/dashboard/arkline' || pathname.startsWith('/dashboard/arkline?'), codes: ['arkline.overview.view'] },
  { matcher: (pathname) => pathname === '/dashboard/arkline/directory' || pathname.startsWith('/dashboard/arkline/directory?'), codes: ['arkline.directory.view', 'arkline.directory.products.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/directory/bom'), codes: ['arkline.directory.bom.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/directory/materials'), codes: ['arkline.directory.materials.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/directory/suppliers'), codes: ['arkline.directory.suppliers.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/directory/purchase-orders'), codes: ['arkline.directory.purchase_orders.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/progress-overview'), codes: ['arkline.progress_snapshot.view', 'arkline.progress_snapshot.kanban.view', 'arkline.progress_snapshot.calendar.view', 'arkline.progress_snapshot.products.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/production-planning/material-fulfillment'), codes: ['arkline.material_fulfillment.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/production-planning'), codes: ['arkline.production_planning.view', 'arkline.production_orders.view', 'arkline.material_fulfillment.view'] },
  { matcher: (pathname) => pathname === '/dashboard/arkline/financial-management' || pathname.startsWith('/dashboard/arkline/financial-management?'), codes: ['arkline.financial_management.view', 'arkline.financial_management.payment_submission.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/financial-management/live-reporting'), codes: ['arkline.financial_management.live_reporting.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/financial-management/reporting'), codes: ['arkline.financial_management.reporting.view'] },
  { matcher: (pathname) => pathname.startsWith('/mobile/arkline/live-reporting'), codes: ['arkline.financial_management.live_reporting.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/financial-management'), codes: ['arkline.financial_management.view', 'arkline.financial_management.payment_submission.view', 'arkline.financial_management.reporting.view', 'arkline.financial_management.live_reporting.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/reimbursement'), codes: ['myarklife.view'] },
]

export function canAccessPath(pathname, role, permissions = [], isAdmin = false) {
  const resolvedRole = resolveRole(role, isAdmin)
  const normalizedPathname = String(pathname || '')

  if (normalizedPathname.startsWith('/dashboard/user-access')) {
    return isAdmin || resolvedRole === 'admin'
  }

  if (
    normalizedPathname.startsWith('/dashboard/settings') ||
    normalizedPathname.startsWith('/dashboard/suppliers') ||
    normalizedPathname.startsWith('/dashboard/brands') ||
    normalizedPathname.startsWith('/dashboard/categories') ||
    normalizedPathname.startsWith('/dashboard/skus') ||
    normalizedPathname.startsWith('/dashboard/rack-locations')
  ) {
    return isAdmin || resolvedRole === 'admin'
  }

  if (isAdmin || resolvedRole === 'admin') return true

  if (resolvedRole === 'external') {
    return (
      normalizedPathname === '/dashboard' ||
      normalizedPathname === '/dashboard/arkline/progress-overview' ||
      normalizedPathname.startsWith('/dashboard/arkline/progress-overview?') ||
      (
        hasPermission(permissions, 'delivery_report.view', false) &&
        (
          normalizedPathname === '/dashboard/delivery-report' ||
          normalizedPathname.startsWith('/dashboard/delivery-report/') ||
          normalizedPathname.startsWith('/dashboard/delivery-report?')
        )
      )
    )
  }

  if (normalizedPathname === '/operations-calendar' || normalizedPathname.startsWith('/operations-calendar?')) {
    return canAccessOperationsCalendar(resolvedRole, permissions, false)
  }

  if (
    (resolvedRole === 'packing_staff' || resolvedRole === 'packing_coordinator') &&
    !hasPermission(permissions, DASHBOARD_SHORTCUT_CODES.stockReplenishment, false) &&
    (normalizedPathname === '/take-requests' || normalizedPathname.startsWith('/take-requests?'))
  ) {
    return false
  }

  const matched = ROUTE_PERMISSION_MAP.find((item) => item.matcher(normalizedPathname))
  if (!matched) return false
  return hasAnyPermission(permissions, matched.codes, false)
}

export function getPermissionMeta(code) {
  const definition = PERMISSION_DEFINITION_MAP.get(code)
  if (!definition) {
    return {
      code,
      label: titleize(code),
      description: '',
      groupKey: 'other',
      groupLabel: 'Other',
      itemKey: code,
      itemLabel: titleize(code),
      action: code.split('.').at(-1) || '',
    }
  }

  return {
    code,
    label: `${labelizeAction(definition.action)} ${definition.itemLabel}`,
    description: `${labelizeAction(definition.action)} access for ${definition.itemLabel} in ${definition.groupLabel}.`,
    ...definition,
  }
}
