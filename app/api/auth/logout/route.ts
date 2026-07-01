import { NextResponse } from "next/server"

import { logout } from "@/lib/auth"

export async function POST() {
  try {
    await logout()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[POST /api/auth/logout] unexpected error:", error)
    return NextResponse.json(
      { error: "Não foi possível encerrar a sessão agora." },
      { status: 500 }
    )
  }
}
