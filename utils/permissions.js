export const ADMIN_EMAIL = 'mr.peneliti@gmail.com'

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'hrga', label: 'HRGA' },
  { value: 'leader', label: 'Leader' },
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
  { value: 'guest', label: 'Guest' },
]

export const OFFICIAL_ROLE_VALUES = ROLE_OPTIONS.map((item) => item.value)

export const LEGACY_ROLE_MAP = {
  hrga_approver: 'hrga',
  arkline_viewer: 'arkline_staff',
  arkline_purchaser: 'arkline_merchandiser',
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
    ],
  },
  {
    key: 'inbound',
    label: 'Inbound',
    items: [
      { key: 'overview', label: 'Inbound Overview', description: 'Halaman ringkasan dan pintu masuk utama workflow inbound.', actions: ['view'] },
      { key: 'new', label: 'New Inbound', description: 'Buat data inbound baru.', actions: ['view', 'add'] },
      { key: 'detail', label: 'Inbound Detail', description: 'Lihat detail setiap inbound yang sudah dibuat.', actions: ['view'] },
      { key: 'edit', label: 'Edit Inbound', description: 'Ubah data inbound yang sudah ada.', actions: ['view', 'edit'] },
      { key: 'unload', label: 'Unload', description: 'Kelola proses bongkar dan data koli inbound.', actions: ['view', 'edit'] },
      { key: 'receiving', label: 'Inbound Receiving', description: 'Lihat proses receiving yang berhubungan dengan inbound.', actions: ['view', 'edit'] },
      { key: 'qc', label: 'Inbound QC', description: 'Lihat keterkaitan inbound dengan proses QC.', actions: ['view'] },
    ],
  },
  {
    key: 'qc',
    label: 'Quality Control',
    items: [
      { key: 'summary', label: 'QC Summary', description: 'Halaman ringkasan performa dan hasil QC.', actions: ['view'] },
      { key: 'receiving', label: 'QC Receiving', description: 'Buat dan kelola rencana alokasi QC receiving.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'grading_task', label: 'Grading Task', description: 'Halaman kerja inspector untuk menjalankan tugas grading QC.', actions: ['view', 'add', 'edit'] },
      { key: 'confirmation', label: 'QC Confirmation', description: 'Kelola hasil final dan konfirmasi QC.', actions: ['view', 'add', 'edit'] },
      { key: 'retur_report', label: 'Retur Report', description: 'Lihat laporan retur berdasarkan hasil QC.', actions: ['view'] },
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
      { key: 'overview', label: 'Storage Overview', description: 'Halaman ringkasan dan pintu masuk utama workflow storage.', actions: ['view'] },
      { key: 'search', label: 'Search Storage', description: 'Cari stok dan lokasi penyimpanan barang.', actions: ['view'] },
      { key: 'registry', label: 'Registry Storage', description: 'Kelola pencatatan penempatan stok ke lokasi storage.', actions: ['view', 'add', 'edit', 'delete'] },
      { key: 'location', label: 'Storage Location', description: 'Lihat ringkasan dan detail lokasi storage.', actions: ['view'] },
      { key: 'restock_instruction', label: 'Restock Instruction', description: 'Halaman penghubung untuk restock submit dan restock picker.', actions: ['view'] },
      { key: 'restock_instruction.submit', label: 'Restock Submit', codePrefix: 'storage.restock_submit', description: 'Buat dan ubah permintaan restock internal.', actions: ['view', 'add', 'edit'] },
      { key: 'restock_instruction.picker', label: 'Restock Picker', codePrefix: 'storage.restock_picker', description: 'Proses pengambilan barang untuk restock instruction.', actions: ['view', 'edit'] },
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

function labelizeAction(action) {
  if (action === 'view') return 'View'
  if (action === 'add') return 'Add'
  if (action === 'edit') return 'Edit'
  if (action === 'delete') return 'Delete'
  if (action === 'print') return 'Print'
  if (action === 'export') return 'Export'
  if (action === 'submit') return 'Submit'
  if (action === 'assign') return 'Assign'
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
        .filter((item) => !(group.key === 'arkline' && item.key === 'financial_management.live_reporting'))
        .map((item) => {
          const codePrefix = item.codePrefix || `${group.key}.${item.key}`
          return {
            key: item.key,
            label: item.label,
            description: item.description || '',
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
  return PERMISSION_DEFINITIONS.map((item) => ({
    code: item.code,
    label: `${labelizeAction(item.action)} ${item.itemLabel}`,
    description: `${labelizeAction(item.action)} access for ${item.itemLabel} in ${item.groupLabel}.`,
  }))
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
  ],
  leader: ['dashboard.home.view', 'myarklife.view'],
  warehouse_leader: [
    'dashboard.home.view',
    'myarklife.view',
    'storage.overview.view',
    'storage.search.view',
    'storage.location.view',
    'inbound.overview.view',
    'inbound.detail.view',
    'packing.overview.view',
    'qc.summary.view',
  ],
  packing_coordinator: [
    'dashboard.home.view',
    'myarklife.view',
    'packing.overview.view',
    'packing.receiving.view',
    'packing.receiving.add',
    'packing.receiving.edit',
    'packing.size_breakdown.view',
    'packing.size_breakdown.edit',
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
  ],
  qc_coordinator: [
    'dashboard.home.view',
    'myarklife.view',
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
    'storage.overview.view',
    'storage.search.view',
    'storage.registry.view',
    'storage.registry.add',
    'storage.registry.edit',
    'storage.registry.delete',
    'storage.location.view',
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
    'storage.overview.view',
    'storage.search.view',
    'storage.registry.view',
    'storage.registry.add',
    'storage.registry.edit',
    'storage.location.view',
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
    'inbound.overview.view',
    'inbound.new.view',
    'inbound.new.add',
    'inbound.detail.view',
    'inbound.edit.view',
    'inbound.edit.edit',
    'inbound.unload.view',
    'inbound.unload.edit',
    'inbound.receiving.view',
    'inbound.receiving.edit',
    'inbound.qc.view',
  ],
  inbound_staff: [
    'dashboard.home.view',
    'myarklife.view',
    'inbound.overview.view',
    'inbound.new.view',
    'inbound.new.add',
    'inbound.detail.view',
    'inbound.edit.view',
    'inbound.edit.edit',
    'inbound.unload.view',
    'inbound.unload.edit',
    'inbound.receiving.view',
    'inbound.receiving.edit',
    'inbound.qc.view',
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
    'arkline.progress_snapshot.view',
    'arkline.progress_snapshot.kanban.view',
    'arkline.progress_snapshot.calendar.view',
    'arkline.progress_snapshot.products.view',
  ],
}

export function getDefaultPermissionsForRole(role) {
  return [...new Set((DEFAULT_ROLE_BUNDLES[role] || []).filter((code) => PERMISSION_CODE_SET.has(code)))]
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

export function expandImpliedPermissions(permissions = []) {
  const expanded = new Set(
    (permissions || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )

  for (const code of Array.from(expanded)) {
    const parts = code.split('.')
    const action = parts.at(-1)
    if (['add', 'edit', 'delete', 'print', 'export', 'submit', 'assign'].includes(action)) {
      expanded.add(`${parts.slice(0, -1).join('.')}.view`)
    }
  }

  return expanded
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
  if (isAdmin || role === 'admin') {
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

  const directoryHome = buildFeatureAccess('arkline.directory', permissions, isAdmin)
  const directoryProducts = buildFeatureAccess('arkline.directory.products', permissions, isAdmin)
  const directoryBom = buildFeatureAccess('arkline.directory.bom', permissions, isAdmin)
  const directoryMaterials = buildFeatureAccess('arkline.directory.materials', permissions, isAdmin)
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
  else if (directoryHome.view || directoryProducts.view || directoryBom.view || directoryMaterials.view) menuHref = '/dashboard/arkline/directory'
  else if (progressHome.view || progressKanban.view || progressCalendar.view || progressProducts.view) menuHref = '/dashboard/arkline/progress-overview'
  else if (productionPlanning.view || productionOrders.view || materialFulfillment.view) menuHref = '/dashboard/arkline/production-planning'

  let financialManagementHref = '/dashboard/arkline/financial-management'
  if (financialManagement.view || paymentSubmission.view) financialManagementHref = '/dashboard/arkline/financial-management'
  else if (liveReporting.view) financialManagementHref = '/mobile/arkline/live-reporting'
  else if (financialReporting.view) financialManagementHref = '/dashboard/arkline/financial-management/reporting'

  if (menuHref === '/dashboard' && (financialManagement.view || paymentSubmission.view || liveReporting.view || financialReporting.view)) {
    menuHref = financialManagementHref
  }

  return {
    menu,
    menuHref,
    overview,
    directory: directoryHome.view || directoryProducts.view || directoryBom.view || directoryMaterials.view,
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
    reimbursementView: myArklife,
    reimbursementSubmit: myArklife,
    reimbursementEdit: myArklife,
    reimbursementApprove: false,
    reimbursementPay: false,
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
      menuHref: '/dashboard/storage',
      overview: true,
      registry: true,
      search: true,
      restockSubmit: true,
      restockPicker: true,
    }
  }

  const overview = hasPermission(permissions, 'storage.overview.view', isAdmin)
  const registry = hasPermission(permissions, 'storage.registry.view', isAdmin)
  const search = hasPermission(permissions, 'storage.search.view', isAdmin)
  const restockInstruction = hasPermission(permissions, 'storage.restock_instruction.view', isAdmin)
  const restockSubmit = hasPermission(permissions, 'storage.restock_submit.view', isAdmin)
  const restockPicker = hasPermission(permissions, 'storage.restock_picker.view', isAdmin)
  const menu = overview || registry || search || restockInstruction || restockSubmit || restockPicker

  let menuHref = '/dashboard'
  if (overview) menuHref = '/dashboard/storage'
  else if (search) menuHref = '/dashboard/storage/search'
  else if (registry) menuHref = '/dashboard/storage/registry'
  else if (restockInstruction || restockSubmit || restockPicker) menuHref = '/dashboard/storage/restock-instruction'

  return {
    menu,
    menuHref,
    overview,
    registry,
    search,
    restockInstruction,
    restockSubmit,
    restockPicker,
  }
}

export function getLandingPath(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') return '/dashboard'
  if (hasPermission(permissions, 'dashboard.home.view', isAdmin)) return '/dashboard'

  const qcAccess = getQcFeatureAccess(permissions, isAdmin, role)
  if (qcAccess.menu) return qcAccess.menuHref
  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  if (storageAccess.menu) return storageAccess.menuHref
  const arklineAccess = getArklineFeatureAccess(role, permissions, isAdmin)
  if (arklineAccess.menu) return arklineAccess.menuHref
  if (canAccessPeopleManagement(permissions, isAdmin)) return '/dashboard/human-resources'
  if (hasPermission(permissions, 'inbound.overview.view', isAdmin)) return '/dashboard/inbound'
  if (hasPermission(permissions, 'packing.overview.view', isAdmin)) return '/dashboard/packing-list'
  if (hasPermission(permissions, 'myarklife.view', isAdmin)) return '/dashboard/myarklife'
  return '/dashboard'
}

export function getAllowedMenus(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') {
    return {
      humanResources: true,
      humanResourcesHref: '/dashboard/human-resources',
      myArklife: true,
      myArklifeHref: '/dashboard/myarklife',
      arkline: true,
      arklineHref: '/dashboard/arkline',
      inbound: true,
      qc: true,
      qcHref: '/dashboard/qc',
      qcInspectorOnly: false,
      packing: true,
      storage: true,
      storageHref: '/dashboard/storage',
      masterData: true,
      userAccess: true,
    }
  }

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  const qcAccess = getQcFeatureAccess(permissions, isAdmin, role)
  const arklineAccess = getArklineFeatureAccess(role, permissions, isAdmin)

  return {
    humanResources: canAccessPeopleManagement(permissions, isAdmin),
    humanResourcesHref: '/dashboard/human-resources',
    myArklife: hasPermission(permissions, 'myarklife.view', isAdmin),
    myArklifeHref: '/dashboard/myarklife',
    arkline: arklineAccess.menu,
    arklineHref: arklineAccess.menuHref,
    inbound: hasPermission(permissions, 'inbound.overview.view', isAdmin),
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
  { matcher: (pathname) => pathname.startsWith('/dashboard/profile'), codes: ['myarklife.view'] },
  { matcher: (pathname) => pathname === '/dashboard/myarklife' || pathname.startsWith('/dashboard/myarklife/'), codes: ['myarklife.view'] },
  { matcher: (pathname) => pathname === '/dashboard/human-resources' || pathname.startsWith('/dashboard/human-resources/'), codes: ['hrga.home.view'] },
  { matcher: (pathname) => pathname === '/dashboard/storage' || pathname.startsWith('/dashboard/storage?'), codes: ['storage.overview.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/search'), codes: ['storage.search.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/registry'), codes: ['storage.registry.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/overview'), codes: ['storage.location.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/restock-instruction'), codes: ['storage.restock_instruction.view', 'storage.restock_submit.view', 'storage.restock_picker.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/storage/restock-request') || pathname === '/restock-request' || pathname.startsWith('/restock-request?'), codes: ['storage.restock_submit.view'] },
  { matcher: (pathname) => pathname === '/take-requests' || pathname.startsWith('/take-requests?'), codes: ['storage.restock_picker.view'] },
  { matcher: (pathname) => pathname === '/dashboard/qc' || pathname.startsWith('/dashboard/qc?'), codes: ['qc.summary.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/receiving') || pathname.startsWith('/mobile/qc/receiving'), codes: ['qc.receiving.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/inspection-task') || pathname.startsWith('/mobile/qc/inspection-task'), codes: ['qc.grading_task.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/confirmation'), codes: ['qc.confirmation.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/qc/retur-report'), codes: ['qc.retur_report.view'] },
  { matcher: (pathname) => pathname === '/dashboard/inbound' || pathname.startsWith('/dashboard/inbound?'), codes: ['inbound.overview.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/new'), codes: ['inbound.new.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/unload'), codes: ['inbound.unload.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/receiving'), codes: ['inbound.receiving.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/qc'), codes: ['inbound.qc.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/inbound/'), codes: ['inbound.detail.view', 'inbound.edit.view'] },
  { matcher: (pathname) => pathname === '/dashboard/packing-list' || pathname.startsWith('/dashboard/packing-list?'), codes: ['packing.overview.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/packing-list/receiving'), codes: ['packing.receiving.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/packing-list/size-breakdown'), codes: ['packing.size_breakdown.view'] },
  { matcher: (pathname) => pathname === '/dashboard/arkline' || pathname.startsWith('/dashboard/arkline?'), codes: ['arkline.overview.view'] },
  { matcher: (pathname) => pathname === '/dashboard/arkline/directory' || pathname.startsWith('/dashboard/arkline/directory?'), codes: ['arkline.directory.view', 'arkline.directory.products.view', 'arkline.directory.bom.view', 'arkline.directory.materials.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/directory/bom'), codes: ['arkline.directory.bom.view'] },
  { matcher: (pathname) => pathname.startsWith('/dashboard/arkline/directory/materials'), codes: ['arkline.directory.materials.view'] },
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
  if (pathname.startsWith('/dashboard/user-access')) {
    return isAdmin || role === 'admin'
  }

  if (
    pathname.startsWith('/dashboard/settings') ||
    pathname.startsWith('/dashboard/suppliers') ||
    pathname.startsWith('/dashboard/brands') ||
    pathname.startsWith('/dashboard/categories') ||
    pathname.startsWith('/dashboard/skus') ||
    pathname.startsWith('/dashboard/rack-locations')
  ) {
    return isAdmin || role === 'admin'
  }

  if (isAdmin || role === 'admin') return true

  const matched = ROUTE_PERMISSION_MAP.find((item) => item.matcher(pathname))
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
