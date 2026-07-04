import { NextResponse } from "next/server"
import { z } from "zod"

import { loginPlatform } from "@/lib/platform/platform-auth"

const loginSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
  password: z.string().min(1, { error: "Informe a senha." }),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    )
  }

  try {
    const result = await loginPlatform(parsed.data.email, parsed.data.password)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[POST /api/founder/auth/login] error:", error)
    return NextResponse.json({ error: "Não foi possível entrar agora. Tente novamente." }, { status: 500 })
  }
}
