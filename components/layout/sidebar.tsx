"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { navItems, getNavItemsForRole, type NavItem } from "@/lib/nav"
import { Button } from "@/components/ui/button"
import { SineryWordmark, SineryIcon } from "@/components/brand/sinery-brand"
import type { UserRole } from "@/lib/generated/prisma/client"

interface SidebarProps {
  role?: UserRole | null
  mobileOpen?: boolean
  onClose?: () => void
  /** Desktop icon-only mode (mobile drawer is always full width). */
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({
  role,
  mobileOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
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
          // Mobile: off-canvas drawer (fixed, out of flow). Desktop: sticky column
          // that stays fully visible while the page scrolls.
          "fixed inset-y-0 left-0 z-50 flex h-svh w-64 shrink-0 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar transition-[transform,width] duration-200 ease-in-out",
          "md:sticky md:top-0 md:z-30 md:translate-x-0",
          collapsed && "md:w-[4.75rem]",
          mobileOpen && "translate-x-0"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-2 border-b border-sidebar-border px-4",
            collapsed && "md:justify-center md:px-2"
          )}
        >
          <Link
            href="/dashboard"
            onClick={onClose}
            aria-label="Sinery — ir para o dashboard"
            className="flex items-center outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            {/* Wordmark shows everywhere except the collapsed desktop rail. */}
            <SineryWordmark priority className={cn(collapsed && "md:hidden")} />
            {/* Icon only appears on the collapsed desktop rail. */}
            {collapsed && <SineryIcon priority className="hidden md:block" />}
          </Link>

          {/* Mobile: close drawer. */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto md:hidden"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="size-4" />
          </Button>

          {/* Desktop expanded: collapse toggle in the header. */}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto hidden md:inline-flex"
              onClick={onToggleCollapse}
              aria-label="Recolher menu"
              title="Recolher menu"
            >
              <PanelLeftClose className="size-4.5" />
            </Button>
          )}
        </div>

        <nav
          className={cn(
            "flex-1 space-y-1 overflow-y-auto px-3 py-4",
            collapsed && "md:px-2"
          )}
        >
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div
          className={cn(
            "border-t border-sidebar-border p-3",
            collapsed && "md:px-2"
          )}
        >
          {/* Desktop collapsed: expand toggle (centered rail button). */}
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto hidden md:flex"
              onClick={onToggleCollapse}
              aria-label="Expandir menu"
              title="Expandir menu"
            >
              <PanelLeftOpen className="size-4.5" />
            </Button>
          )}

          {!collapsed && (
            <p className="px-1 text-xs text-muted-foreground">
              Sinery © {new Date().getFullYear()} — Tecnologia para clínicas
            </p>
          )}
        </div>
      </aside>
    </>
  )
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      // Native tooltip in collapsed mode (labels are hidden on desktop).
      title={collapsed ? item.title : undefined}
      aria-label={item.title}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "md:justify-center md:px-0",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className={cn("size-4.5 shrink-0", isActive && "text-primary")} />
      <span className={cn(collapsed && "md:hidden")}>{item.title}</span>
    </Link>
  )
}
