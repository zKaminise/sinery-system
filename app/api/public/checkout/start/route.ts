import { NextResponse } from "next/server"

import { startCheckoutSchema } from "@/lib/validators/checkout"
import { startPublicCheckout } from "@/lib/asaas/asaas-checkout-service"
import { getPublicCheckoutConfig } from "@/lib/asaas/asaas-config"

function corsHeaders(): Record<string, string> {
  const origin = getPublicCheckoutConfig().allowedOrigin
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
  if (origin) headers["Access-Control-Allow-Origin"] = origin
  return headers
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(request: Request) {
  const headers = corsHeaders()
  const body = await request.json().catch(() => null)
  const parsed = startCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400, headers })
  }

  const result = await startPublicCheckout(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400, headers })
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: 201, headers })
}
