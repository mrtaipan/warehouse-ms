'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL, expandImpliedPermissions, getArklineFeatureAccess, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()

const defaultAccess = {
  menu: false,
  menuHref: '/dashboard',
  overview: false,
  directory: false,
  directoryBom: false,
  directoryCreate: false,
  progressOverview: false,
  progressKanban: false,
  progressCalendar: false,
  progressProducts: false,
  productionPlanning: false,
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

      const {
        data: { user },
      } = await supabase.auth.getUser()

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

      const { data: rolePermissions } = await supabase.from('dir_user_roles').select('permission_code').eq('role', resolvedRole)
      const permissions = Array.from(expandImpliedPermissions((rolePermissions || []).map((item) => item.permission_code)))
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
