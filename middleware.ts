import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/signup"]

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (PUBLIC_ROUTES.some((route) => path.startsWith(route))) {
    return NextResponse.next()
  }

  if (path === "/" || path.startsWith("/dashboard") || path.startsWith("/markets") || path.startsWith("/signals") || path.startsWith("/forecast") || path.startsWith("/analytics") || path.startsWith("/portfolio") || path.startsWith("/risk") || path.startsWith("/macro") || path.startsWith("/flow") || path.startsWith("/copilot") || path.startsWith("/alerts") || path.startsWith("/settings") || path.startsWith("/stocks")) {
    const token = request.cookies.get("veltrix_access")?.value
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
