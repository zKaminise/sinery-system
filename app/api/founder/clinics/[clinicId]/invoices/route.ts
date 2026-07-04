import { NextResponse } from "next/server"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManageBilling } from "@/lib/platform/platform-permissions"
import { createInvoiceSchema } from "@/lib/validators/founder"
import { createInvoice } from "@/lib/platform/founder-actions"

export async function POST(request: Request, { params }: { params: Promise<{ clinicId: string }> }) {
  const auth = await requirePlatformApiUser({ can: canManageBilling })
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { clinicId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 })
  }

  const result = await createInvoice(clinicId, parsed.data, auth.user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, data: { invoiceId: result.invoiceId } }, { status: 201 })
}
