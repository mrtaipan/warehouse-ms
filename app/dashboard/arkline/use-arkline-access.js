'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL, getArklineFeatureAccess, resolveRole } from '@/utils/permissions'
import { getRolePermissionCodes } from '@/utils/role-permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()

const defaultAccess = {
  menu: false,
  menuHref: '/dashboard',
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
  progressOverview: false,
  progressKanban: false,
  progressCalendar: false,
  progressProducts: false,
  productionPlanning: false,
  productionOrdersView: false,
  productionOrdersPrint: false,
  materialFulfillmentView: false,
  financialManagement: false,
  financialManagementHref: '/dashboard/arkline/financial-management',
  financialManagementLiveReportingView: false,
  financialManagementLiveReportingAdd: false,
  financialManagementLiveReportingEdit: false,
  financialReporting: false,
  reimbursementView: false,
  reimbursementSubmit: false,
  reimbursementApprove: false,
  reimbursementPay: false,
}

export default function useArklineAccess() {
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState(defaultAccess)
  const [role, setRole] = useState('')

  useEffect(() => {
    let active = true

    async function loadAccess() {
      setLoading(true)

      let user = null

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        user = session?.user || null
      } catch {
        user = null
      }

      if (!user) {
        if (active) {
          setAccess(defaultAccess)
          setRole('')
          setLoading(false)
        }
        return
      }

      const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
      const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
      const resolvedRole = resolveRole(profile?.role, isAdmin)

      const { data: permissions } = await getRolePermissionCodes(supabase, resolvedRole, { includeImplied: true })
      const nextAccess = getArklineFeatureAccess(resolvedRole, permissions, isAdmin)

      if (active) {
        setAccess(nextAccess)
        setRole(resolvedRole)
        setLoading(false)
      }
    }

    void loadAccess()

    return () => {
      active = false
    }
  }, [])

  return { loading, access, role }
}
