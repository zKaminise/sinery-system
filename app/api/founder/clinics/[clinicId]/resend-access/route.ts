import { NextResponse } from "next/server"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManageClinics } from "@/lib/platform/platform-permissions"
import { resendClinicOwnerAccess } from "@/lib/platform/founder-actions"

export async function POST(_request: Request, { params }: { params: Promise<{ clinicId: string }> }) {
  const auth = await requirePlatformApiUser({ can: canManageClinics })
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { clinicId } = await params
  const result = await resendClinicOwnerAccess(clinicId, auth.user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, data: { emailStatus: result.emailStatus } })
}
