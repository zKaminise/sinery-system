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

  // Clinic administration (settings page)
  CLINIC_UPDATED: "CLINIC_UPDATED",
  CLINIC_SETTINGS_UPDATED: "CLINIC_SETTINGS_UPDATED",

  // User management
  USER_UPDATED: "USER_UPDATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_STATUS_CHANGED: "USER_STATUS_CHANGED",
  USER_TEMP_PASSWORD_RESET: "USER_TEMP_PASSWORD_RESET",
  USER_ACCESS_DENIED: "USER_ACCESS_DENIED",

  // Patients
  PATIENT_CREATED: "PATIENT_CREATED",
  PATIENT_UPDATED: "PATIENT_UPDATED",
  PATIENT_STATUS_CHANGED: "PATIENT_STATUS_CHANGED",
  PATIENT_ARCHIVED: "PATIENT_ARCHIVED",
  PATIENT_ACCESS_DENIED: "PATIENT_ACCESS_DENIED",

  // Professionals
  PROFESSIONAL_CREATED: "PROFESSIONAL_CREATED",
  PROFESSIONAL_UPDATED: "PROFESSIONAL_UPDATED",
  PROFESSIONAL_STATUS_CHANGED: "PROFESSIONAL_STATUS_CHANGED",
  PROFESSIONAL_ACCESS_DENIED: "PROFESSIONAL_ACCESS_DENIED",

  // Working hours
  WORKING_HOUR_CREATED: "WORKING_HOUR_CREATED",
  WORKING_HOUR_UPDATED: "WORKING_HOUR_UPDATED",
  WORKING_HOUR_DELETED: "WORKING_HOUR_DELETED",
  WORKING_HOUR_STATUS_CHANGED: "WORKING_HOUR_STATUS_CHANGED",

  // Services
  SERVICE_CREATED: "SERVICE_CREATED",
  SERVICE_UPDATED: "SERVICE_UPDATED",
  SERVICE_STATUS_CHANGED: "SERVICE_STATUS_CHANGED",
  SERVICE_ACCESS_DENIED: "SERVICE_ACCESS_DENIED",

  // Professional <-> Service links
  PROFESSIONAL_SERVICE_LINKED: "PROFESSIONAL_SERVICE_LINKED",
  PROFESSIONAL_SERVICE_UNLINKED: "PROFESSIONAL_SERVICE_UNLINKED",

  // Appointments (agenda)
  APPOINTMENT_CREATED: "APPOINTMENT_CREATED",
  APPOINTMENT_UPDATED: "APPOINTMENT_UPDATED",
  APPOINTMENT_RESCHEDULED: "APPOINTMENT_RESCHEDULED",
  APPOINTMENT_CONFIRMED: "APPOINTMENT_CONFIRMED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  APPOINTMENT_COMPLETED: "APPOINTMENT_COMPLETED",
  APPOINTMENT_NO_SHOW: "APPOINTMENT_NO_SHOW",
  APPOINTMENT_ACCESS_DENIED: "APPOINTMENT_ACCESS_DENIED",

  // Other domain events (used in seed samples)
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
  CLINIC_UPDATED: "Clínica atualizada",
  CLINIC_SETTINGS_UPDATED: "Operação atualizada",
  USER_UPDATED: "Usuário atualizado",
  USER_ROLE_CHANGED: "Função alterada",
  USER_STATUS_CHANGED: "Status alterado",
  USER_TEMP_PASSWORD_RESET: "Senha provisória redefinida",
  USER_ACCESS_DENIED: "Acesso negado",
  PATIENT_CREATED: "Paciente criado",
  PATIENT_UPDATED: "Paciente atualizado",
  PATIENT_STATUS_CHANGED: "Status do paciente alterado",
  PATIENT_ARCHIVED: "Paciente arquivado",
  PATIENT_ACCESS_DENIED: "Acesso negado",
  PROFESSIONAL_CREATED: "Profissional criado",
  PROFESSIONAL_UPDATED: "Profissional atualizado",
  PROFESSIONAL_STATUS_CHANGED: "Status do profissional alterado",
  PROFESSIONAL_ACCESS_DENIED: "Acesso negado",
  WORKING_HOUR_CREATED: "Horário criado",
  WORKING_HOUR_UPDATED: "Horário atualizado",
  WORKING_HOUR_DELETED: "Horário removido",
  WORKING_HOUR_STATUS_CHANGED: "Status do horário alterado",
  SERVICE_CREATED: "Serviço criado",
  SERVICE_UPDATED: "Serviço atualizado",
  SERVICE_STATUS_CHANGED: "Status do serviço alterado",
  SERVICE_ACCESS_DENIED: "Acesso negado",
  PROFESSIONAL_SERVICE_LINKED: "Serviço vinculado ao profissional",
  PROFESSIONAL_SERVICE_UNLINKED: "Serviço desvinculado do profissional",
  APPOINTMENT_CREATED: "Consulta criada",
  APPOINTMENT_UPDATED: "Consulta atualizada",
  APPOINTMENT_RESCHEDULED: "Consulta remarcada",
  APPOINTMENT_CONFIRMED: "Consulta confirmada",
  APPOINTMENT_CANCELLED: "Consulta cancelada",
  APPOINTMENT_COMPLETED: "Consulta concluída",
  APPOINTMENT_NO_SHOW: "Falta registrada",
  APPOINTMENT_ACCESS_DENIED: "Acesso negado",
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
  if (
    action === "AUTH_LOGIN_FAILED" ||
    action === "ACCESS_DENIED" ||
    action === "USER_ACCESS_DENIED" ||
    action === "PATIENT_ACCESS_DENIED" ||
    action === "PROFESSIONAL_ACCESS_DENIED" ||
    action === "SERVICE_ACCESS_DENIED" ||
    action === "APPOINTMENT_ACCESS_DENIED" ||
    action === "APPOINTMENT_CANCELLED" ||
    action === "APPOINTMENT_NO_SHOW"
  ) {
    return "danger"
  }
  if (
    action === "AUTH_PASSWORD_CHANGED" ||
    action === "USER_ROLE_CHANGED" ||
    action === "USER_STATUS_CHANGED" ||
    action === "USER_TEMP_PASSWORD_RESET" ||
    action === "PATIENT_STATUS_CHANGED" ||
    action === "PATIENT_ARCHIVED" ||
    action === "PROFESSIONAL_STATUS_CHANGED" ||
    action === "SERVICE_STATUS_CHANGED" ||
    action === "WORKING_HOUR_DELETED" ||
    action === "PROFESSIONAL_SERVICE_UNLINKED" ||
    action === "APPOINTMENT_RESCHEDULED"
  ) {
    return "warning"
  }
  if (
    action === "AUTH_LOGIN_SUCCESS" ||
    action.endsWith("_CREATED") ||
    action === "PROFESSIONAL_SERVICE_LINKED" ||
    action === "APPOINTMENT_CONFIRMED" ||
    action === "APPOINTMENT_COMPLETED"
  ) {
    return "success"
  }
  return "info"
}
