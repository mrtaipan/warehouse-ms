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
  { value: 'arkline_staff', label: 'Arkline Staff' },
  { value: 'arkline_approver', label: 'Arkline Approver' },
]

function hasAnyPermission(permissions, codes) {
  return codes.some((code) => permissions.includes(code))
}

export function getArklineFeatureAccess(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') {
    return {
      menu: true,
      menuHref: '/dashboard/arkline',
      overview: true,
      financialManagement: true,
      reimbursementView: true,
      reimbursementSubmit: true,
      reimbursementApprove: true,
      reimbursementPay: true,
    }
  }

  const reimbursementView = hasAnyPermission(permissions, [
    'arkline.finance.reimbursement.view',
    'arkline.finance.reimbursement.submit',
    'arkline.finance.reimbursement.approve',
    'arkline.finance.reimbursement.pay',
  ])
  const reimbursementSubmit = permissions.includes('arkline.finance.reimbursement.submit')
  const reimbursementApprove = permissions.includes('arkline.finance.reimbursement.approve')
  const reimbursementPay = permissions.includes('arkline.finance.reimbursement.pay')
  const financialManagement = reimbursementView
  const menu = financialManagement

  return {
    menu,
    menuHref: financialManagement ? '/dashboard/arkline/financial-management' : '/dashboard',
    overview: menu,
    financialManagement,
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

  if (isAdmin || role === 'admin') return true
  if (pathname === '/dashboard') return true
  if (pathname.startsWith('/dashboard/profile')) return true

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
