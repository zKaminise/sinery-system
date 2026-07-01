import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"

/**
 * Standard error codes for API responses. Kept small and stable so clients
 * can branch on `error.code` without parsing human messages.
 */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    code: ApiErrorCode
    message: string
  }
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

interface ErrorResponseOptions {
  code?: ApiErrorCode
  /** Internal-only technical detail (error object, DB message). Logged, never sent. */
  logContext?: string
  logError?: unknown
  logMetadata?: Record<string, unknown>
}

/**
 * Builds a safe error envelope. The user-facing `message` never contains a
 * stack trace; any technical detail passed via `logError`/`logMetadata` is
 * recorded through the internal logger (and Sentry) instead.
 */
export function errorResponse(
  message: string,
  status = 400,
  options: ErrorResponseOptions = {}
): NextResponse<ApiError> {
  const code = options.code ?? defaultCodeForStatus(status)

  if (options.logError || options.logMetadata) {
    logger.error(message, {
      context: options.logContext ?? "api",
      error: options.logError,
      metadata: { code, status, ...options.logMetadata },
    })
  }

  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  )
}

function defaultCodeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST"
    case 401:
      return "UNAUTHORIZED"
    case 403:
      return "FORBIDDEN"
    case 404:
      return "NOT_FOUND"
    case 409:
      return "CONFLICT"
    case 422:
      return "VALIDATION_ERROR"
    case 503:
      return "SERVICE_UNAVAILABLE"
    default:
      return "INTERNAL_ERROR"
  }
}
