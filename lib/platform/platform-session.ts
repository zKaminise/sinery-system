import "server-only"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

import { validateAuthSecret } from "@/lib/auth-secret"
import type { PlatformRoleValue } from "@/lib/platform/platform-permissions"

/**
 * Platform (founder) session — deliberately SEPARATE from the clinic session
 * (lib/session.ts). Different cookie name AND a `typ: "platform"` claim that is
 * verified on read, so a clinic JWT can never be accepted as a platform session
 * (and vice-versa) even though both are signed with AUTH_SECRET.
 */

export interface PlatformSessionPayload {
  platformUserId: string
  role: PlatformRoleValue
}

const DEFAULT_COOKIE_NAME = "sinery_platform_session"
const DEFAULT_MAX_AGE_SECONDS = 86400 // 1 dia (mais curto que a sessão de clínica)
const PLATFORM_TYP = "platform"

function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  const check = validateAuthSecret(secret, process.env.NODE_ENV === "production")
  if (!check.ok) throw new Error(check.error)
  return new TextEncoder().encode(secret)
}

export function getPlatformCookieName(): string {
  return process.env.SESSION_PLATFORM_COOKIE_NAME || DEFAULT_COOKIE_NAME
}

function getMaxAgeSeconds(): number {
  const raw = process.env.SESSION_PLATFORM_MAX_AGE_SECONDS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_SECONDS
}

export async function encryptPlatformSession(payload: PlatformSessionPayload): Promise<string> {
  return new SignJWT({ ...payload, typ: PLATFORM_TYP })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${getMaxAgeSeconds()}s`)
    .sign(getAuthSecretKey())
}

export async function decryptPlatformSession(
  token: string | undefined
): Promise<PlatformSessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), { algorithms: ["HS256"] })
    if (
      payload.typ !== PLATFORM_TYP ||
      typeof payload.platformUserId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null
    }
    return {
      platformUserId: payload.platformUserId,
      role: payload.role as PlatformRoleValue,
    }
  } catch {
    return null
  }
}

export async function createPlatformSessionCookie(payload: PlatformSessionPayload): Promise<void> {
  const token = await encryptPlatformSession(payload)
  const cookieStore = await cookies()
  cookieStore.set(getPlatformCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getMaxAgeSeconds(),
  })
}

export async function clearPlatformSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(getPlatformCookieName())
}

export async function getPlatformSessionFromCookies(): Promise<PlatformSessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(getPlatformCookieName())?.value
  return decryptPlatformSession(token)
}
