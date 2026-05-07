export const ADMIN_EMAIL = 'mr.peneliti@gmail.com'

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'storage_staff', label: 'Storage Staff' },
  { value: 'storage_coordinator', label: 'Storage Coordinator' },
  { value: 'inbound_staff', label: 'Inbound Staff' },
  { value: 'qc_coordinator', label: 'QC Coordinator' },
  { value: 'qc_inspector', label: 'QC Inspector' },
  { value: 'packing_staff', label: 'Packing Staff' },
]

function hasAnyPermission(permissions, codes) {
  return codes.some((code) => permissions.includes(code))
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
  if (permissions.length > 0) return '/dashboard'

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  if (storageAccess.menu) return storageAccess.menuHref
  return '/dashboard'
}

export function getAllowedMenus(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') {
    return {
      arkline: true,
      inbound: true,
      qc: true,
      qcInspectorOnly: false,
      packing: true,
      storage: true,
      storageHref: '/dashboard/storage',
      masterData: true,
      userAccess: true,
    }
  }

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)

  return {
    arkline: false,
    inbound: false,
    qc: false,
    qcInspectorOnly:
      permissions.includes('qc.inspection.do') &&
      !permissions.includes('qc.dashboard.view') &&
      !permissions.includes('qc.receiving.edit') &&
      !permissions.includes('qc.confirmation.edit') &&
      !permissions.includes('qc.retur.view'),
    packing: false,
    storage: storageAccess.menu,
    storageHref: storageAccess.menuHref,
    masterData: false,
    userAccess: false,
  }
}

export function canAccessPath(pathname, role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') return true
  if (pathname === '/dashboard') return true
  if (pathname.startsWith('/dashboard/profile')) return true

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)

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

  if (pathname.startsWith('/dashboard/qc/inspection-task')) return false
  if (pathname.startsWith('/dashboard/qc')) return false

  if (pathname.startsWith('/dashboard/packing-list')) return false
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
