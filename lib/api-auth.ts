import "server-only"

import { getCurrentUser, type CurrentUser } from "@/lib/current-user"

export type ApiAuthResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; status: number; message: string }

/**
 * Resolves the current user for an API route. Returns a discriminated result
 * so handlers can early-return a consistent error envelope. Optionally
 * enforces OWNER/ADMIN.
 */
export async function requireApiUser(
  options: { ownerOrAdmin?: boolean } = {}
): Promise<ApiAuthResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, status: 401, message: "Você precisa estar autenticado." }
  }
  if (options.ownerOrAdmin && user.role !== "OWNER" && user.role !== "ADMIN") {
    return {
      ok: false,
      status: 403,
      message: "Você não tem permissão para executar esta ação.",
    }
  }
  return { ok: true, user }
}
