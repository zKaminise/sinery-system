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
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  description: string
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
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    description: "Preferências do sistema",
  },
]

export function getNavItemByHref(href: string): NavItem | undefined {
  return navItems.find((item) => href === item.href || href.startsWith(`${item.href}/`))
}
