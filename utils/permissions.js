export const ADMIN_EMAIL = 'mr.peneliti@gmail.com'

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'storage_staff', label: 'Storage Staff' },
  { value: 'inbound_staff', label: 'Inbound Staff' },
  { value: 'qc_coordinator', label: 'QC Coordinator' },
  { value: 'qc_inspector', label: 'QC Inspector' },
  { value: 'packing_staff', label: 'Packing Staff' },
]

export function getLandingPath(role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') return '/dashboard/storage'
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
      masterData: true,
      userAccess: true,
    }
  }

  return {
    inbound: false,
    qc: false,
    qcInspectorOnly: false,
    packing: false,
    storage: true,
    masterData: false,
    userAccess: false,
  }
}

export function canAccessPath(pathname, role, permissions = [], isAdmin = false) {
  if (isAdmin || role === 'admin') return true
  if (pathname === '/dashboard') return true
  if (pathname.startsWith('/dashboard/storage')) return true
  return false
}
