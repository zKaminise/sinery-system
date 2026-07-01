import "server-only"
import { cache } from "react"

import { prisma } from "@/lib/prisma"
import { getSessionFromCookies } from "@/lib/session"
import type { Clinic, UserRole, UserStatus } from "@/lib/generated/prisma/client"

/** Safe-to-expose user shape — never includes passwordHash. */
export interface CurrentUser {
  id: string
  clinicId: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  temporaryPassword: boolean
}

/**
 * Resolves the logged-in user from the session cookie, re-validating
 * against the database on every call (a user or clinic can be deactivated
 * between requests, and the JWT alone wouldn't reflect that). Memoized per
 * request with React's `cache` so multiple call sites in one render pass
 * (layout + page + header) share a single query instead of one each.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSessionFromCookies()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      clinicId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      temporaryPassword: true,
      clinic: { select: { status: true } },
    },
  })

  if (!user || user.status !== "ACTIVE" || user.clinic.status !== "ACTIVE") {
    return null
  }

  return {
    id: user.id,
    clinicId: user.clinicId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    temporaryPassword: user.temporaryPassword,
  }
})

export const getCurrentUserClinic = cache(async (): Promise<Clinic | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  return prisma.clinic.findUnique({ where: { id: user.clinicId } })
})
