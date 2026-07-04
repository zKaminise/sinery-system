import { NextResponse } from "next/server"

import { getPublicCheckoutStatus } from "@/lib/asaas/asaas-checkout-service"
import { getPublicCheckoutConfig } from "@/lib/asaas/asaas-config"

function corsHeaders(): Record<string, string> {
  const origin = getPublicCheckoutConfig().allowedOrigin
  const headers: Record<string, string> = { "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }
  if (origin) headers["Access-Control-Allow-Origin"] = origin
  return headers
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params
  const data = await getPublicCheckoutStatus(publicId)
  if (!data) return NextResponse.json({ error: "Checkout não encontrado." }, { status: 404, headers: corsHeaders() })
  return NextResponse.json({ ok: true, data }, { headers: corsHeaders() })
}
