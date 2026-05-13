import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that never require auth
const PUBLIC_ROUTES = ["/", "/login", "/signup"]

// Routes that require the auth cookie
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/markets",
  "/signals",
  "/forecast",
  "/analytics",
  "/portfolio",
  "/risk",
  "/macro",
  "/flow",
  "/copilot",
  "/alerts",
  "/settings",
  "/stocks",
]

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Always allow public routes
  if (PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route + "/"))) {
    return NextResponse.next()
  }

  // Protect app routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))
  if (isProtected) {
    const token = request.cookies.get("veltrix_access")?.value
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)"],
}
