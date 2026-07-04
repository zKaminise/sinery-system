import { NextResponse } from "next/server"
import { z } from "zod"

import { requirePlatformApiUser } from "@/lib/platform/current-platform-user"
import { canManageBilling } from "@/lib/platform/platform-permissions"
import { createBillingNotificationMock } from "@/lib/platform/founder-actions"

const schema = z.object({
  type: z.enum([
    "PAYMENT_DUE_SOON",
    "PAYMENT_DUE_TODAY",
    "PAYMENT_OVERDUE",
    "PAYMENT_SUSPENSION_WARNING",
    "PAYMENT_SUSPENDED",
    "PAYMENT_CONFIRMED",
  ]),
  invoiceId: z.string().optional(),
})

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

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 })
  }

  const result = await createBillingNotificationMock(clinicId, parsed.data.type, auth.user.id, parsed.data.invoiceId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
