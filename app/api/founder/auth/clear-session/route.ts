import { NextResponse } from "next/server"

import { clearPlatformSessionCookie } from "@/lib/platform/platform-session"

/**
 * Clears a stale platform session and redirects to /founder/login. Used when
 * the authoritative check finds no valid PlatformUser (e.g. the row was removed
 * after the cookie was issued) — avoids a redirect loop, mirroring the clinic
 * app's /api/auth/clear-session.
 */
export async function GET(request: Request) {
  await clearPlatformSessionCookie()
  return NextResponse.redirect(new URL("/founder/login", request.url))
}
