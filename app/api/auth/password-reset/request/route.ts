import { NextResponse } from "next/server"
import { z } from "zod"

import { requestPasswordReset } from "@/lib/auth/password-reset"

const GENERIC = "Se este e-mail estiver cadastrado, enviaremos um código de recuperação."
const schema = z.object({ email: z.email() })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  // Always respond generically — never reveal whether the email exists.
  if (!parsed.success) return NextResponse.json({ ok: true, message: GENERIC })

  try {
    await requestPasswordReset({
      email: parsed.data.email,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })
  } catch {
    // swallow — never leak internal errors on this endpoint
  }
  return NextResponse.json({ ok: true, message: GENERIC })
}
