"use client"

import * as React from "react"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import type { UserRole } from "@/lib/generated/prisma/client"

interface AppShellProps {
  children: React.ReactNode
  user: { name: string; role: UserRole } | null
  clinicName: string | null
}

const COLLAPSE_STORAGE_KEY = "sinery.sidebar.collapsed"

// Tiny external store for the desktop collapse preference. Using
// useSyncExternalStore (instead of an effect that calls setState) keeps this
// hydration-safe: the server + first client render use `false`, then React
// reconciles to the persisted value right after hydration.
const collapseStore = {
  listeners: new Set<() => void>(),
  subscribe(cb: () => void) {
    collapseStore.listeners.add(cb)
    return () => {
      collapseStore.listeners.delete(cb)
    }
  },
  getSnapshot(): boolean {
    try {
      return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
    } catch {
      return false
    }
  },
  getServerSnapshot(): boolean {
    return false
  },
  toggle() {
    const next = !collapseStore.getSnapshot()
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0")
    } catch {
      /* localStorage unavailable — no persistence, but UI still toggles */
    }
    collapseStore.listeners.forEach((l) => l())
  },
}

export function AppShell({ children, user, clinicName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const collapsed = React.useSyncExternalStore(
    collapseStore.subscribe,
    collapseStore.getSnapshot,
    collapseStore.getServerSnapshot
  )

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar
        role={user?.role ?? null}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => collapseStore.toggle()}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          user={user}
          clinicName={clinicName}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
