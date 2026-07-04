import { NextResponse } from "next/server"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManageBilling } from "@/lib/platform/platform-permissions"
import { recalcAllClinics } from "@/lib/platform/founder-actions"

export async function POST() {
  const auth = await requirePlatformApiUser({ can: canManageBilling })
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const result = await recalcAllClinics(auth.user.id)
  return NextResponse.json({ success: true, data: result })
}
