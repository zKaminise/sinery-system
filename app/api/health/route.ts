import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET() {
  const timestamp = new Date().toISOString()
  const environment = process.env.NODE_ENV ?? "development"

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: "ok",
      database: "ok",
      timestamp,
      environment,
    })
  } catch (error) {
    console.error("[/api/health] database check failed:", error)

    return NextResponse.json(
      {
        status: "error",
        database: "error",
        timestamp,
        environment,
      },
      { status: 503 }
    )
  }
}
