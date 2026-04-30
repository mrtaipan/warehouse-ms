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
  if (isAdmin || role === 'admin') return '/dashboard/storage'

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  if (permissions.includes('qc.inspection.do')) return '/dashboard/qc/inspection-task'
  if (permissions.some((item) => item.startsWith('qc.'))) return '/dashboard/qc'
  if (permissions.some((item) => item.startsWith('inbound.'))) return '/dashboard/inbound'
  if (storageAccess.menu) return storageAccess.menuHref
  if (permissions.includes('packing.view')) return '/dashboard/packing-list'
  return '/dashboard/storage'
}

export function getAllowedMenus(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') {
    return {
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
    inbound: permissions.some((item) => item.startsWith('inbound.')),
    qc: permissions.some((item) => item.startsWith('qc.')),
    qcInspectorOnly:
      permissions.includes('qc.inspection.do') &&
      !permissions.includes('qc.dashboard.view') &&
      !permissions.includes('qc.receiving.edit') &&
      !permissions.includes('qc.confirmation.edit') &&
      !permissions.includes('qc.retur.view'),
    packing: permissions.includes('packing.view'),
    storage: storageAccess.menu,
    storageHref: storageAccess.menuHref,
    masterData: permissions.some((item) => item.startsWith('masterdata.')),
    userAccess: permissions.includes('useraccess.manage'),
  }
}

export function canAccessPath(pathname, role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') return true
  if (pathname === '/dashboard') return true

  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)

  if (pathname === '/dashboard/storage' || pathname.startsWith('/dashboard/storage?')) return storageAccess.menu
  if (pathname.startsWith('/dashboard/storage/overview')) return storageAccess.overview
  if (pathname.startsWith('/dashboard/storage/registry')) return storageAccess.registry
  if (pathname.startsWith('/dashboard/storage/search')) return storageAccess.search
  if (pathname.startsWith('/dashboard/storage/restock-request')) return storageAccess.restockSubmit
  if (pathname === '/restock-request' || pathname.startsWith('/restock-request?')) return storageAccess.restockSubmit
  if (pathname === '/take-requests' || pathname.startsWith('/take-requests?')) return storageAccess.restockPicker

  if (pathname.startsWith('/dashboard/inbound')) return permissions.includes('inbound.view')

  if (pathname.startsWith('/dashboard/qc/inspection-task')) {
    return permissions.includes('qc.inspection.do') || permissions.includes('qc.dashboard.view')
  }
  if (pathname.startsWith('/dashboard/qc')) {
    return permissions.some((item) =>
      ['qc.dashboard.view', 'qc.receiving.edit', 'qc.confirmation.edit', 'qc.retur.view', 'qc.retur.print'].includes(item)
    )
  }

  if (pathname.startsWith('/dashboard/packing-list')) return permissions.includes('packing.view')

  if (
    pathname.startsWith('/dashboard/suppliers') ||
    pathname.startsWith('/dashboard/brands') ||
    pathname.startsWith('/dashboard/categories') ||
    pathname.startsWith('/dashboard/skus') ||
    pathname.startsWith('/dashboard/rack-locations')
  ) {
    return permissions.includes('masterdata.view')
  }

  if (pathname.startsWith('/dashboard/user-access')) return permissions.includes('useraccess.manage')
  return false
}
