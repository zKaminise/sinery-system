import "server-only"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

import type { UserRole } from "@/lib/generated/prisma/client"

export interface SessionPayload {
  userId: string
  clinicId: string
  role: UserRole
}

const DEFAULT_COOKIE_NAME = "sinery_session"
const DEFAULT_MAX_AGE_SECONDS = 604800 // 7 dias

function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error(
      'AUTH_SECRET não está configurado. Copie ".env.example" para ".env" e defina AUTH_SECRET (ex: rode "openssl rand -base64 32" e cole o resultado).'
    )
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
