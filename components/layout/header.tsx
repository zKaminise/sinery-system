"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { LogOut, Menu, Search } from "lucide-react"

import { getNavItemByHref } from "@/lib/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import type { UserRole } from "@/lib/generated/prisma/client"

const roleLabels: Record<UserRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  RECEPTIONIST: "Recepção",
  PROFESSIONAL: "Profissional",
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

interface HeaderUser {
  name: string
  role: UserRole
}

interface HeaderProps {
  onMenuClick?: () => void
  user: HeaderUser | null
  clinicName: string | null
}

export function Header({ onMenuClick, user, clinicName }: HeaderProps) {
  const pathname = usePathname()
  const current = getNavItemByHref(pathname)
  const [loggingOut, setLoggingOut] = React.useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      window.location.href = "/login"
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-base font-semibold text-foreground">
          {current?.title ?? "Sinery"}
        </h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          {current?.description ?? "Sistema operacional para clínicas"}
        </p>
      </div>

      <div className="relative ml-2 hidden flex-1 max-w-sm lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar pacientes, agendamentos..."
          className="pl-9"
          disabled
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 border-l border-border pl-3 outline-none">
              <div className="hidden flex-col items-end leading-tight sm:flex">
                <span className="text-sm font-medium text-foreground">
                  {clinicName ?? "Clínica"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.name} · {roleLabels[user.role]}
                </span>
              </div>
              <Avatar>
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {roleLabels[user.role]} · {clinicName ?? "Clínica"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={loggingOut}
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                {loggingOut ? "Saindo..." : "Sair"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
