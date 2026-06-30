"use client"

import { usePathname } from "next/navigation"
import { Menu, Search } from "lucide-react"

import { getNavItemByHref } from "@/lib/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme/theme-toggle"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const current = getNavItemByHref(pathname)

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

        <div className="hidden items-center gap-3 border-l border-border pl-3 sm:flex">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-medium text-foreground">
              Clínica Sorria Odonto
            </span>
            <span className="text-xs text-muted-foreground">Recepção</span>
          </div>
          <Avatar>
            <AvatarFallback>CS</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
