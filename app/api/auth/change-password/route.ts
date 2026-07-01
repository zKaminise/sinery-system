import { NextResponse } from "next/server"

import { changePassword } from "@/lib/auth"
import { changePasswordSchema } from "@/lib/validation/auth"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return NextResponse.json(
      { error: firstIssue?.message ?? "Dados inválidos." },
      { status: 400 }
    )
  }

  try {
    const result = await changePassword(parsed.data.password)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Não foi possível alterar a senha." },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[POST /api/auth/change-password] unexpected error:", error)
    return NextResponse.json(
      { error: "Não foi possível alterar a senha agora. Tente novamente." },
      { status: 500 }
    )
  }
}
