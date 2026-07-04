import { NextResponse } from "next/server"
import { z } from "zod"

import { changePlatformPassword } from "@/lib/platform/platform-auth"

const schema = z
  .object({
    password: z
      .string()
      .min(8, { error: "A senha deve ter ao menos 8 caracteres." })
      .regex(/[a-zA-Z]/, { error: "A senha deve conter ao menos uma letra." })
      .regex(/[0-9]/, { error: "A senha deve conter ao menos um número." }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    error: "As senhas não coincidem.",
    path: ["confirmPassword"],
  })

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 })
  }

  const result = await changePlatformPassword(parsed.data.password)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }
  return NextResponse.json({ success: true })
}
