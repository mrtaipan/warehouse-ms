import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { ADMIN_EMAIL, canAccessPath, getLandingPath } from '@/utils/permissions'

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
  const isTakeRequestsPath = pathname === '/take-requests'
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL
  let role = isAdmin ? 'admin' : 'storage_staff'

  if (user) {
    const { data: profile } = await supabase
      .from('dir_user_profiles')
      .select('role')
      .eq('email', user.email?.toLowerCase())
      .maybeSingle()

    role = isAdmin ? 'admin' : profile?.role || 'storage_staff'
  }

  let permissions = []

  if (user) {
    const { data: rolePermissions } = await supabase
      .from('role_permissions')
      .select('permission_code')
      .eq('role', role)

    permissions = (rolePermissions || []).map((item) => item.permission_code)
  }

  if (!user && isDashboardPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!user && isTakeRequestsPath) {
    return NextResponse.redirect(new URL('/login?next=/take-requests', request.url))
  }

  if (user && isDashboardPath && !canAccessPath(pathname, role, permissions, isAdmin)) {
    return NextResponse.redirect(new URL(getLandingPath(role, permissions, isAdmin), request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL(getLandingPath(role, permissions, isAdmin), request.url))
  }

  return response
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/take-requests'],
}
