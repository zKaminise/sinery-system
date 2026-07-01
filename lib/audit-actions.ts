/**
 * Canonical audit-log action names. Kept as string constants (not a Prisma
 * enum) so new event types can be added without a schema migration — the
 * AuditLog.action column stays a plain string for flexibility.
 */
export const AuditAction = {
  // Authentication
  AUTH_LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS",
  AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  AUTH_PASSWORD_CHANGED: "AUTH_PASSWORD_CHANGED",

  // System / observability
  SYSTEM_HEALTH_CHECK: "SYSTEM_HEALTH_CHECK",
  SYSTEM_DEEP_HEALTH_CHECK: "SYSTEM_DEEP_HEALTH_CHECK",

  // Auditing itself
  AUDIT_LOG_VIEWED: "AUDIT_LOG_VIEWED",
  ACCESS_DENIED: "ACCESS_DENIED",

  // Domain events (used in seed samples; full CRUD comes in later prompts)
  PATIENT_CREATED: "PATIENT_CREATED",
  APPOINTMENT_CREATED: "APPOINTMENT_CREATED",
  CLINIC_CREATED: "CLINIC_CREATED",
  USER_CREATED: "USER_CREATED",
} as const

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction]

/** Human-readable pt-BR labels for known actions, used by the audit UI. */
export const auditActionLabels: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "Login realizado",
  AUTH_LOGIN_FAILED: "Falha no login",
  AUTH_LOGOUT: "Logout",
  AUTH_PASSWORD_CHANGED: "Senha alterada",
  SYSTEM_HEALTH_CHECK: "Verificação de saúde",
  SYSTEM_DEEP_HEALTH_CHECK: "Verificação profunda",
  AUDIT_LOG_VIEWED: "Auditoria consultada",
  ACCESS_DENIED: "Acesso negado",
  PATIENT_CREATED: "Paciente criado",
  APPOINTMENT_CREATED: "Agendamento criado",
  CLINIC_CREATED: "Clínica criada",
  USER_CREATED: "Usuário criado",
}

export function getAuditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action
}

/**
 * Visual severity buckets for badge coloring in the audit UI.
 * "danger" for security-relevant failures, "warning" for sensitive changes,
 * "info" for routine events.
 */
export function getAuditActionTone(action: string): "danger" | "warning" | "success" | "info" {
  if (action === "AUTH_LOGIN_FAILED" || action === "ACCESS_DENIED") return "danger"
  if (action === "AUTH_PASSWORD_CHANGED") return "warning"
  if (action === "AUTH_LOGIN_SUCCESS" || action.endsWith("_CREATED")) return "success"
  return "info"
}
