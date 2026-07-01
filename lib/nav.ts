import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  MessagesSquare,
  Stethoscope,
  ClipboardList,
  Sparkles,
  Settings,
  ScrollText,
  Activity,
} from "lucide-react"

import type { UserRole } from "@/lib/generated/prisma/client"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  description: string
  /** If set, only these roles see the item. Undefined = visible to all. */
  roles?: UserRole[]
}

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Visão geral da clínica",
  },
  {
    title: "Agenda",
    href: "/agenda",
    icon: CalendarDays,
    description: "Consultas e horários",
  },
  {
    title: "Pacientes",
    href: "/pacientes",
    icon: Users,
    description: "Cadastro e histórico de pacientes",
  },
  {
    title: "Conversas",
    href: "/conversas",
    icon: MessagesSquare,
    description: "Mensagens com pacientes",
  },
  {
    title: "Profissionais",
    href: "/profissionais",
    icon: Stethoscope,
    description: "Equipe da clínica",
  },
  {
    title: "Serviços",
    href: "/servicos",
    icon: ClipboardList,
    description: "Procedimentos oferecidos",
  },
  {
    title: "Sinery Assist",
    href: "/assist",
    icon: Sparkles,
    description: "Assistente inteligente da clínica",
  },
  {
    title: "Auditoria",
    href: "/auditoria",
    icon: ScrollText,
    description: "Registro de eventos do sistema",
    roles: ["OWNER", "ADMIN"],
  },
  {
    title: "Status",
    href: "/status",
    icon: Activity,
    description: "Saúde da aplicação e do banco",
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    description: "Preferências do sistema",
  },
]

export function getNavItemByHref(href: string): NavItem | undefined {
  return navItems.find((item) => href === item.href || href.startsWith(`${item.href}/`))
}

/** Filters nav items by the given user role. Items without `roles` are always shown. */
export function getNavItemsForRole(role: UserRole): NavItem[] {
  return navItems.filter((item) => !item.roles || item.roles.includes(role))
}
