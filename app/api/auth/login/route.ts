import { NextResponse } from "next/server"

import { login } from "@/lib/auth"
import { loginSchema } from "@/lib/validation/auth"

const GENERIC_ERROR = "E-mail ou senha inválidos."

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password)

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? GENERIC_ERROR }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[POST /api/auth/login] unexpected error:", error)
    return NextResponse.json(
      { error: "Não foi possível efetuar o login agora. Tente novamente." },
      { status: 500 }
    )
  }
}
