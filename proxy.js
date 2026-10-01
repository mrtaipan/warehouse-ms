import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { ADMIN_EMAIL, canAccessPath, getLandingPath, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

export async function proxy(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isDashboardPath = pathname.startsWith('/dashboard')
  const isMobilePath = pathname.startsWith('/mobile')
  const isTakeRequestsPath = pathname === '/take-requests'
  const isRestockRequestPath = pathname === '/restock-request'
  const emailAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL
  let role = emailAdmin ? 'admin' : 'storage_staff'

  if (user) {
    const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
    const profileRole = profile?.role ? resolveRole(profile.role, emailAdmin) : ''

    role = profileRole === 'admin' ? 'admin' : profileRole || 'storage_staff'
  }

  const isAdmin = emailAdmin || role === 'admin'

  let permissions = []

  if (user && !isAdmin) {
    const { data: rolePermissions } = await supabase
      .from('dir_user_roles')
      .select('permission_code')
      .eq('role', role)

    permissions = (rolePermissions || []).map((item) => item.permission_code)
  }

  if (!user && (isDashboardPath || isMobilePath)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!user && isTakeRequestsPath) {
    return NextResponse.redirect(new URL('/login?next=/take-requests', request.url))
  }

  if (!user && isRestockRequestPath) {
    return NextResponse.redirect(new URL('/login?next=/restock-request', request.url))
  }

  if (user && (isDashboardPath || isMobilePath) && !canAccessPath(pathname, role, permissions, isAdmin)) {
    return NextResponse.redirect(new URL(getLandingPath(role, permissions, isAdmin), request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL(getLandingPath(role, permissions, isAdmin), request.url))
  }

  return response
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/mobile/:path*', '/take-requests', '/restock-request'],
}
