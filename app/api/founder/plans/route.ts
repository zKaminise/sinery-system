import { NextResponse } from "next/server"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManagePlans } from "@/lib/platform/platform-permissions"
import { planSchema } from "@/lib/validators/founder"
import { upsertPlan } from "@/lib/platform/founder-actions"

export async function POST(request: Request) {
  const auth = await requirePlatformApiUser({ can: canManagePlans })
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = planSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 })
  }

  const result = await upsertPlan(parsed.data, auth.user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, data: { planId: result.planId } }, { status: 201 })
}
