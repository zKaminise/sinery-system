import { NextResponse } from "next/server"
import { z } from "zod"

import { verifyResetCodeForEmail } from "@/lib/auth/password-reset"

const schema = z.object({ email: z.email(), code: z.string().trim().min(4).max(10) })

const MESSAGES: Record<string, string> = {
  ok: "Código válido.",
  invalid: "Código incorreto.",
  expired: "Código expirado. Solicite um novo.",
  locked: "Muitas tentativas. Solicite um novo código.",
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ status: "invalid", message: MESSAGES.invalid }, { status: 400 })

  const result = await verifyResetCodeForEmail(parsed.data)
  return NextResponse.json({ status: result.status, message: MESSAGES[result.status] })
}
