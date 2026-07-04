import { NextResponse } from "next/server"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManageClinics } from "@/lib/platform/platform-permissions"
import { clinicStatusActionSchema } from "@/lib/validators/founder"
import { applyClinicStatusAction } from "@/lib/platform/founder-actions"

export async function POST(request: Request, { params }: { params: Promise<{ clinicId: string }> }) {
  const auth = await requirePlatformApiUser({ can: canManageClinics })
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { clinicId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = clinicStatusActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 })
  }

  const result = await applyClinicStatusAction(clinicId, parsed.data.action, auth.user.id, parsed.data.reason)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, data: { clinicStatus: result.clinicStatus } })
}
