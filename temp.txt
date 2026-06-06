export const ADMIN_EMAIL = 'mr.peneliti@gmail.com'

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'storage_staff', label: 'Storage Staff' },
  { value: 'storage_coordinator', label: 'Storage Coordinator' },
  { value: 'inbound_staff', label: 'Inbound Staff' },
  { value: 'qc_coordinator', label: 'QC Coordinator' },
  { value: 'qc_staff', label: 'QC Staff' },
  { value: 'qc_inspector', label: 'QC Inspector' },
  { value: 'packing_staff', label: 'Packing Staff' },
  { value: 'hrga_approver', label: 'HRGA Approver' },
  { value: 'arkline_viewer', label: 'Arkline Viewer' },
  { value: 'arkline_purchaser', label: 'Arkline Purchaser' },
]

function hasAnyPermission(permissions, codes) {
  return codes.some((code) => permissions.includes(code))
}

export function canAccessPeopleManagement(role = '', isAdmin = false) {
  return isAdmin || role === 'admin' || role === 'hrga_approver'
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
      progressOverview: true,
      progressKanban: true,
      progressCalendar: true,
      progressProducts: true,
      productionPlanning: true,
      financialManagement: true,
      financialReporting: true,
      reimbursementView: true,
      reimbursementSubmit: true,
      reimbursementApprove: true,
      reimbursementPay: true,
    }
  }

  const overview = permissions.includes('arkline.overview.view')
  const directory = hasAnyPermission(permissions, ['arkline.directory.view', 'arkline.directory.bom.view', 'arkline.directory.create'])
  const directoryBom = permissions.includes('arkline.directory.bom.view')
  const directoryCreate = permissions.includes('arkline.directory.create')
  const progressKanban = permissions.includes('arkline.progress.kanban.view')
  const progressCalendar = permissions.includes('arkline.progress.calendar.view')
  const progressProducts = permissions.includes('arkline.progress.products.view')
  const progressOverview = hasAnyPermission(permissions, [
    'arkline.progress.view',
    'arkline.progress.kanban.view',
    'arkline.progress.calendar.view',
    'arkline.progress.products.view',
  ])
  const productionPlanning = permissions.includes('arkline.production-planning.view')
  const financialManagement = permissions.includes('arkline.financial-management.view')
  const financialReporting = false
  const reimbursementView = false
  const reimbursementSubmit = false
  const reimbursementApprove = false
  const reimbursementPay = false
  const menu = overview || directory || progressOverview || productionPlanning || financialManagement

  let menuHref = '/dashboard'
  if (overview) menuHref = '/dashboard/arkline'
  else if (directory) menuHref = '/dashboard/arkline/directory'
  else if (progressOverview) menuHref = '/dashboard/arkline/progress-overview'
  else if (productionPlanning) menuHref = '/dashboard/arkline/production-planning'
  else if (financialManagement) menuHref = '/dashboard/arkline/financial-management'

  return {
    menu,
    menuHref,
    overview,
    directory,
    directoryBom,
    directoryCreate,
    progressOverview,
    progressKanban,
    progressCalendar,
    progressProducts,
    productionPlanning,
    financialManagement,
    financialReporting,
    reimbursementView,
    reimbursementSubmit,
    reimbursementApprove,
    reimbursementPay,
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

  const dashboard = permissions.includes('qc.dashboard.view')
  const receiving = permissions.includes('qc.receiving.edit')
  const inspectionTask = permissions.includes('qc.inspection.do')
  const confirmation = permissions.includes('qc.confirmation.edit')
  const retur = permissions.includes('qc.retur.view')
  const menu = dashboard || receiving || inspectionTask || confirmation || retur
  const inspectionTaskOnly = inspectionTask && !dashboard && !receiving && !confirmation && !retur

  let menuHref = '/dashboard/qc'
  if (!dashboard && receiving) {
    menuHref = '/dashboard/qc/receiving'
  } else if (!dashboard && !receiving && confirmation) {
    menuHref = '/dashboard/qc/confirmation'
  } else if (!dashboard && !receiving && !confirmation && retur) {
    menuHref = '/dashboard/qc/retur-report'
  } else if (!dashboard && !receiving && !confirmation && !retur && inspectionTask) {
    menuHref = '/mobile/qc/inspection-task'
  }

  return {
    menu,
    menuHref,
    dashboard,
    receiving,
    inspectionTask,
    confirmation,
    retur,
    inspectionTaskOnly,
  }
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

  const overview = hasAnyPermission(permissions, ['storage.overview.view', 'storage.view'])
  const registry = hasAnyPermission(permissions, ['storage.registry.view', 'storage.edit'])
  const search = hasAnyPermission(permissions, ['storage.search.view', 'storage.view'])
  const restockSubmit = hasAnyPermission(permissions, ['storage.restock_submit.view', 'storage.view'])
  const restockPicker = hasAnyPermission(permissions, ['storage.restock_picker.view', 'storage.view'])
  const menu = overview || registry || search || restockSubmit || restockPicker

  let menuHref = '/dashboard/storage'
  if (!overview && !registry && !search && restockSubmit) {
    menuHref = '/restock-request'
  } else if (!overview && !registry && !search && !restockSubmit && restockPicker) {
    menuHref = '/take-requests'
  }

  return {
    menu,
    menuHref,
    overview,
    registry,
    search,
    restockSubmit,
    restockPicker,
  }
}

export function getLandingPath(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') return '/dashboard'

  const qcAccess = getQcFeatureAccess(permissions, isAdmin, role)
  if (qcAccess.menu) return qcAccess.menuHref
  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  if (storageAccess.menu) return storageAccess.menuHref
  const arklineAccess = getArklineFeatureAccess(role, permissions, isAdmin)
  if (arklineAccess.menu) return arklineAccess.menuHref
  return '/dashboard'
}

export function getAllowedMenus(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') {
    return {
      humanResources: true,
      humanResourcesHref: '/dashboard/human-resources',
      myArklife: false,
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
    humanResources: canAccessPeopleManagement(role, isAdmin),
    humanResourcesHref: '/dashboard/human-resources',
    myArklife: false,
    myArklifeHref: '/dashboard/myarklife',
    arkline: arklineAccess.menu,
    arklineHref: arklineAccess.menuHref,
    inbound: false,
    qc: qcAccess.menu,
    qcHref: qcAccess.menuHref,
    qcInspectorOnly: qcAccess.inspectionTaskOnly,
    packing: false,
    storage: storageAccess.menu,
    storageHref: storageAccess.menuHref,
    masterData: false,
    userAccess: false,
  }
}

export function canAccessPath(pathname, role, permissions = [], isAdmin = false) {
  if (pathname.startsWith('/mobile/qc/receiving')) {
    return canAccessPath('/dashboard/qc/receiving', role, permissions, isAdmin)
  }

  if (pathname.startsWith('/mobile/qc/inspection-task')) {
    return canAccessPath('/dashboard/qc/inspection-task', role, permissions, isAdmin)
  }

  if (pathname === '/dashboard/human-resources' || pathname.startsWith('/dashboard/human-resources/')) {
    return canAccessPeopleManagement(role, isAdmin)
  }

  if (isAdmin || role === 'admin') return true
  if (pathname === '/dashboard') return true
  if (pathname.startsWith('/dashboard/profile')) return true
  if (pathname === '/dashboard/myarklife' || pathname.startsWith('/dashboard/myarklife/')) return true

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  const qcAccess = getQcFeatureAccess(permissions, isAdmin, role)
  const arklineAccess = getArklineFeatureAccess(role, permissions, isAdmin)

  if (pathname === '/dashboard/storage' || pathname.startsWith('/dashboard/storage?')) return storageAccess.menu
  if (pathname.startsWith('/dashboard/storage/overview')) return storageAccess.overview
  if (pathname.startsWith('/dashboard/storage/registry')) return storageAccess.registry
  if (pathname.startsWith('/dashboard/storage/search')) return storageAccess.search
  if (pathname.startsWith('/dashboard/storage/restock-instruction')) {
    return storageAccess.restockSubmit || storageAccess.restockPicker
  }
  if (pathname.startsWith('/dashboard/storage/restock-request')) return storageAccess.restockSubmit
  if (pathname === '/restock-request' || pathname.startsWith('/restock-request?')) return storageAccess.restockSubmit
  if (pathname === '/take-requests' || pathname.startsWith('/take-requests?')) return storageAccess.restockPicker

  if (pathname.startsWith('/dashboard/inbound')) return false

  if (pathname === '/dashboard/qc' || pathname.startsWith('/dashboard/qc?')) return qcAccess.dashboard
  if (pathname.startsWith('/dashboard/qc/receiving')) return qcAccess.receiving
  if (pathname.startsWith('/dashboard/qc/inspection-task')) return qcAccess.inspectionTask
  if (pathname.startsWith('/dashboard/qc/confirmation')) return qcAccess.confirmation
  if (pathname.startsWith('/dashboard/qc/retur-report')) return qcAccess.retur
  if (pathname.startsWith('/dashboard/qc')) return qcAccess.menu

  if (pathname.startsWith('/dashboard/packing-list')) return false
  if (pathname === '/dashboard/arkline' || pathname.startsWith('/dashboard/arkline?')) return arklineAccess.overview
  if (pathname === '/dashboard/arkline/directory' || pathname.startsWith('/dashboard/arkline/directory?')) return arklineAccess.directory
  if (pathname.startsWith('/dashboard/arkline/directory/bom')) return arklineAccess.directoryBom
  if (pathname.startsWith('/dashboard/arkline/progress-overview')) return arklineAccess.progressOverview
  if (pathname.startsWith('/dashboard/arkline/production-planning')) return arklineAccess.productionPlanning
  if (pathname.startsWith('/dashboard/arkline/financial-management/reporting')) return arklineAccess.financialReporting
  if (pathname.startsWith('/dashboard/arkline/financial-management')) return arklineAccess.financialManagement
  if (pathname.startsWith('/dashboard/arkline')) return false

  if (
    pathname.startsWith('/dashboard/settings') ||
    pathname.startsWith('/dashboard/suppliers') ||
    pathname.startsWith('/dashboard/brands') ||
    pathname.startsWith('/dashboard/categories') ||
    pathname.startsWith('/dashboard/skus') ||
    pathname.startsWith('/dashboard/rack-locations')
  ) {
    return false
  }

  if (pathname.startsWith('/dashboard/user-access')) return false
  return false
}
