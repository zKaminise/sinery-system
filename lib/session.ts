import "server-only"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

import type { UserRole } from "@/lib/generated/prisma/client"
import { validateAuthSecret } from "@/lib/auth-secret"

export interface SessionPayload {
  userId: string
  clinicId: string
  role: UserRole
  /**
   * The clinic's slug (subdomain) at login time. Optional so older cookies
   * (issued before multi-tenant subdomains) stay valid. Used for fast
   * host↔session tenant binding; the authoritative binding check still
   * compares against the clinic's slug in the database. See
   * lib/tenant/tenant-security.ts and docs/domains-and-dns.md.
   */
  slug?: string
}

const DEFAULT_COOKIE_NAME = "sinery_session"
const DEFAULT_MAX_AGE_SECONDS = 604800 // 7 dias

function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  // In production this also rejects placeholder / too-short secrets so the app
  // can never sign sessions with a guessable key (session forgery).
  const check = validateAuthSecret(secret, process.env.NODE_ENV === "production")
  if (!check.ok) {
    throw new Error(check.error)
  }
  return new TextEncoder().encode(secret)
}

export function getSessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME
}

export function getSessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_MAX_AGE_SECONDS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_SECONDS
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${getSessionMaxAgeSeconds()}s`)
    .sign(getAuthSecretKey())
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      algorithms: ["HS256"],
    })

    if (
      typeof payload.userId !== "string" ||
      typeof payload.clinicId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null
    }

    return {
      userId: payload.userId,
      clinicId: payload.clinicId,
      role: payload.role as UserRole,
      slug: typeof payload.slug === "string" ? payload.slug : undefined,
    }
  } catch {
    return null
  }
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload)
  const cookieStore = await cookies()

  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionMaxAgeSeconds(),
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(getSessionCookieName())
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(getSessionCookieName())?.value
  return decryptSession(token)
}
