import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

/**
 * Deeper health check that verifies database connectivity and returns a few
 * cheap signals (clinic count, response time). Public for now, but exposes no
 * sensitive data — a future revision may gate it behind a token or IP allowlist
 * (see docs/observability.md).
 */
export async function GET() {
  const startedAt = Date.now()
  const timestamp = new Date().toISOString()
  const environment = process.env.NODE_ENV ?? "development"
  const version = process.env.npm_package_version ?? "0.1.0"

  try {
    const clinicsCount = await prisma.clinic.count()
    const responseTimeMs = Date.now() - startedAt

    logger.info("Deep health check executed", {
      context: "health",
      metadata: { clinicsCount, responseTimeMs },
    })

    return NextResponse.json({
      status: "ok",
      database: "ok",
      clinicsCount,
      responseTimeMs,
      version,
      timestamp,
      environment,
    })
  } catch (error) {
    logger.error("Deep health check failed: database unreachable", {
      context: "health",
      error,
    })

    return NextResponse.json(
      {
        status: "error",
        database: "error",
        message: "Não foi possível conectar ao banco de dados.",
        responseTimeMs: Date.now() - startedAt,
        version,
        timestamp,
        environment,
      },
      { status: 503 }
    )
  }
}
