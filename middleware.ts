import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config'

/**
 * Public routes. Everything else requires either an authenticated Supabase
 * session or an explicit read-only demo session (`?demo=1` / `veltrix_demo=1`).
 *
 * Deliberately an allowlist of what is OPEN rather than a list of what is
 * protected so new routes under app/(app)/ fail closed by default.
 */
const PUBLIC = ['/', '/login', '/signup', '/auth']
export const DEMO_COOKIE = 'veltrix_demo'

export async function middleware(request: NextRequest) {
  const demoParam = request.nextUrl.searchParams.get('demo')
  if (demoParam === '1') {
    request.cookies.set(DEMO_COOKIE, '1')
  } else if (demoParam === '0') {
    request.cookies.delete(DEMO_COOKIE)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  if (demoParam === '1') {
    response.cookies.set(DEMO_COOKIE, '1', { path: '/', sameSite: 'lax', maxAge: 86_400 })
  } else if (demoParam === '0') {
    response.cookies.delete(DEMO_COOKIE)
  }

  // Refreshes the session cookie; must run before any auth check.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC.some((p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)))
  const isDemo = request.cookies.get(DEMO_COOKIE)?.value === '1'
  const needsAuth = !isPublic && !isDemo

  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
