import { NextResponse } from "next/server"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManageClinics } from "@/lib/platform/platform-permissions"
import { createClinicSchema } from "@/lib/validators/founder"
import { createClinicWithOwner } from "@/lib/platform/founder-actions"

export async function POST(request: Request) {
  const auth = await requirePlatformApiUser({ can: canManageClinics })
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = createClinicSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 })
  }

  const result = await createClinicWithOwner(parsed.data, auth.user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, data: result.data }, { status: 201 })
}
