import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { decryptSession, getSessionCookieName } from "@/lib/session"

// Starting with Next.js 16, "Middleware" is called "Proxy" — this file
// replaces what used to be middleware.ts. See node_modules/next/dist/docs.

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/conversas",
  "/profissionais",
  "/servicos",
  "/assist",
  "/configuracoes",
  "/alterar-senha",
]

const PUBLIC_ROUTES = ["/login"]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/**
 * Optimistic auth check only: verifies the session cookie's signature and
 * expiration, without hitting the database. This is intentional — Proxy
 * runs on every request (including prefetches) and should stay fast. The
 * authoritative check (user/clinic still ACTIVE, temporaryPassword forcing
 * /alterar-senha) happens in app/(app)/layout.tsx via getCurrentUser(),
 * which does query the database. See docs/authentication.md.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const token = request.cookies.get(getSessionCookieName())?.value
  const session = await decryptSession(token)

  if (isProtectedPath(pathname) && !session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (PUBLIC_ROUTES.includes(pathname) && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
}
