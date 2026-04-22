import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'mr.peneliti@gmail.com'

export async function middleware(request) {
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
  const isStoragePath = pathname === '/dashboard' || pathname.startsWith('/dashboard/storage')
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL

  if (!user && isDashboardPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isDashboardPath && !isAdmin && !isStoragePath) {
    return NextResponse.redirect(new URL('/dashboard/storage', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard/storage', request.url))
  }

  return response
}

export const config = {
  matcher: ['/login', '/dashboard/:path*'],
}
