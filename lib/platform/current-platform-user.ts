import "server-only"

import { cache } from "react"

import { prisma } from "@/lib/prisma"
import { getPlatformSessionFromCookies } from "@/lib/platform/platform-session"
import type { PlatformRoleValue } from "@/lib/platform/platform-permissions"

export interface CurrentPlatformUser {
  id: string
  name: string
  email: string
  role: PlatformRoleValue
  temporaryPassword: boolean
}

/**
 * Resolves the current PlatformUser from the platform session cookie and
 * re-validates ACTIVE status against the DB on every call (a deactivated
 * platform user loses access mid-session). Memoized per request.
 */
export const getCurrentPlatformUser = cache(async (): Promise<CurrentPlatformUser | null> => {
  const session = await getPlatformSessionFromCookies()
  if (!session) return null

  const user = await prisma.platformUser.findUnique({ where: { id: session.platformUserId } })
  if (!user || user.status !== "ACTIVE") return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    temporaryPassword: user.temporaryPassword,
  }
})

export type PlatformApiAuthResult =
  | { ok: true; user: CurrentPlatformUser }
  | { ok: false; status: number; message: string }

/**
 * API guard for /api/founder/* routes. Returns a discriminated result and,
 * optionally, enforces a capability predicate against the platform role.
 */
export async function requirePlatformApiUser(
  options: { can?: (role: PlatformRoleValue) => boolean } = {}
): Promise<PlatformApiAuthResult> {
  const user = await getCurrentPlatformUser()
  if (!user) {
    return { ok: false, status: 401, message: "Acesso restrito à plataforma Sinery." }
  }
  if (options.can && !options.can(user.role)) {
    return { ok: false, status: 403, message: "Você não tem permissão para esta ação de plataforma." }
  }
  return { ok: true, user }
}
