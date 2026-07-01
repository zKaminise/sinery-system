"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Stethoscope, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { navItems, getNavItemsForRole, type NavItem } from "@/lib/nav"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/lib/generated/prisma/client"

interface SidebarProps {
  role?: UserRole | null
  mobileOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ role, mobileOpen = false, onClose }: SidebarProps) {
  // Role-gated items (e.g. Auditoria) are hidden for roles that lack access.
  // When role is unknown, fall back to items that aren't role-restricted.
  const items = role
    ? getNavItemsForRole(role)
    : navItems.filter((item) => !item.roles)

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0",
          mobileOpen && "translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
                Sinery
              </span>
              <span className="text-xs text-muted-foreground">System</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <SidebarLink key={item.href} item={item} onNavigate={onClose} />
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <p className="text-xs text-muted-foreground">
            Sinery © {new Date().getFullYear()} — Tecnologia para clínicas
          </p>
        </div>
      </aside>
    </>
  )
}

function SidebarLink({
  item,
  onNavigate,
}: {
  item: NavItem
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className={cn("size-4.5 shrink-0", isActive && "text-primary")} />
      <span>{item.title}</span>
    </Link>
  )
}
