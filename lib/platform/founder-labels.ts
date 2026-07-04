/** Display labels + badge tones for founder-panel statuses (pure, importable anywhere). */

export type BadgeTone = "success" | "warning" | "danger" | "muted" | "info"

export const subscriptionStatusLabels: Record<string, string> = {
  FREE: "Gratuito",
  TRIALING: "Trial",
  ACTIVE: "Ativo",
  PAST_DUE: "Em atraso",
  SUSPENDED: "Suspenso",
  CANCELLED: "Cancelado",
  EXEMPT: "Isento",
}

export const subscriptionStatusTones: Record<string, BadgeTone> = {
  FREE: "muted",
  TRIALING: "info",
  ACTIVE: "success",
  PAST_DUE: "warning",
  SUSPENDED: "danger",
  CANCELLED: "danger",
  EXEMPT: "muted",
}

export const clinicStatusLabels: Record<string, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
  SETUP_PENDING: "Em configuração",
  SUSPENDED: "Suspensa",
}

export const clinicStatusTones: Record<string, BadgeTone> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  SETUP_PENDING: "info",
  SUSPENDED: "danger",
}

export const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  PAID: "Paga",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
  MANUALLY_CONFIRMED: "Confirmada manual",
}

export const invoiceStatusTones: Record<string, BadgeTone> = {
  DRAFT: "muted",
  PENDING: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "muted",
  REFUNDED: "muted",
  MANUALLY_CONFIRMED: "success",
}

export const platformRoleLabels: Record<string, string> = {
  FOUNDER: "Founder",
  PLATFORM_ADMIN: "Admin da plataforma",
  SUPPORT: "Suporte",
  FINANCE: "Financeiro",
}

/** Tailwind classes for a tone (base-ui/shadcn friendly). */
export function toneClasses(tone: BadgeTone): string {
  switch (tone) {
    case "success":
      return "bg-success/10 text-success border-success/20"
    case "warning":
      return "bg-warning/10 text-warning border-warning/20"
    case "danger":
      return "bg-destructive/10 text-destructive border-destructive/20"
    case "info":
      return "bg-secondary/10 text-secondary border-secondary/20"
    case "muted":
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}
