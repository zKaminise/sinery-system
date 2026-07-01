import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"

const APP_NAME = "Sinery System"

/**
 * Lightweight liveness probe — no database access, so it stays fast and cheap
 * for frequent external monitoring (e.g. UptimeRobot hitting it every minute).
 * For a database-aware check, use /api/health/deep.
 */
export async function GET() {
  logger.debug("Health check executed", { context: "health" })

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    app: APP_NAME,
  })
}
