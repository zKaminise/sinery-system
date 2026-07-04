import { NextResponse } from "next/server"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManageBilling } from "@/lib/platform/platform-permissions"
import { invoiceActionSchema } from "@/lib/validators/founder"
import { applyInvoiceAction } from "@/lib/platform/founder-actions"

export async function PATCH(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const auth = await requirePlatformApiUser({ can: canManageBilling })
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { invoiceId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = invoiceActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 })
  }

  const result = await applyInvoiceAction(invoiceId, parsed.data, auth.user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
