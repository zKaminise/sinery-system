"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, Package, Wallet, LogOut, Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SineryWordmark } from "@/components/brand/sinery-brand"
import { platformRoleLabels } from "@/lib/platform/founder-labels"
import { canManageBilling, canManagePlans, type PlatformRoleValue } from "@/lib/platform/platform-permissions"

interface FounderNavItem {
  title: string
  href: string
  icon: typeof LayoutDashboard
  show?: (role: PlatformRoleValue) => boolean
}

const NAV: FounderNavItem[] = [
  { title: "Visão geral", href: "/founder", icon: LayoutDashboard },
  { title: "Clientes", href: "/founder/clientes", icon: Building2 },
  { title: "Planos", href: "/founder/planos", icon: Package, show: canManagePlans },
  { title: "Financeiro", href: "/founder/billing", icon: Wallet, show: canManageBilling },
]

export function FounderShell({
  user,
  children,
}: {
  user: { name: string; role: PlatformRoleValue }
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()
  const items = NAV.filter((i) => !i.show || i.show(user.role))
  const isActive = (href: string) =>
    href === "/founder" ? pathname === "/founder" : pathname === href || pathname.startsWith(`${href}/`)

  async function handleLogout() {
    await fetch("/api/founder/auth/logout", { method: "POST" })
    window.location.href = "/founder/login"
  }

  return (
    <div className="flex min-h-svh bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-svh w-64 shrink-0 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200",
          "md:sticky md:top-0 md:z-30 md:translate-x-0",
          mobileOpen && "translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <Link href="/founder" className="flex flex-col gap-0.5" onClick={() => setMobileOpen(false)}>
            <SineryWordmark priority className="h-7" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Founder</span>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className={cn("size-4.5 shrink-0", active && "text-primary")} />
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <p className="px-1 text-xs text-muted-foreground">Sinery Founder · painel interno</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-base font-semibold text-foreground">Sinery Founder</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">Operação da plataforma Sinery</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden flex-col items-end leading-tight sm:flex">
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <span className="text-xs text-muted-foreground">{platformRoleLabels[user.role] ?? user.role}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
