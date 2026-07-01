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

export function AppShell({ children, user, clinicName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        role={user?.role ?? null}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
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
