import { NextResponse } from "next/server"
import { z } from "zod"

import { resetPasswordWithCode } from "@/lib/auth/password-reset"

const schema = z
  .object({
    email: z.email(),
    code: z.string().trim().min(4).max(10),
    password: z
      .string()
      .min(8, { error: "A senha deve ter ao menos 8 caracteres." })
      .regex(/[a-zA-Z]/, { error: "A senha deve conter ao menos uma letra." })
      .regex(/[0-9]/, { error: "A senha deve conter ao menos um número." }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { error: "As senhas não coincidem.", path: ["confirmPassword"] })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 })
  }

  const result = await resetPasswordWithCode({ email: parsed.data.email, code: parsed.data.code, newPassword: parsed.data.password })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, message: "Senha redefinida com sucesso. Faça login novamente." })
}
