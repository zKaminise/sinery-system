"use client"

import * as React from "react"
import { ShieldAlert, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SineryWordmark } from "@/components/brand/sinery-brand"

/**
 * Full-screen block shown when a clinic is SUSPENDED or INACTIVE. The user stays
 * signed in (so they can read the message) but cannot reach any clinic screen.
 * Logout is always available.
 */
export function ClinicBlockedScreen({ reason }: { reason: "suspended" | "inactive" }) {
  const [loggingOut, setLoggingOut] = React.useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      window.location.href = "/login"
    }
  }

  const title = reason === "suspended" ? "Acesso temporariamente suspenso" : "Acesso indisponível"
  const message =
    reason === "suspended"
      ? "O acesso desta clínica ao Sinery System está temporariamente suspenso. Entre em contato com a Sinery para regularizar e reativar o acesso."
      : "O acesso desta clínica está inativo no momento. Entre em contato com a Sinery para mais informações."

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <SineryWordmark className="mx-auto mb-6 h-8" />
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="size-7 text-destructive" />
        </div>
        <h1 className="mb-2 text-lg font-semibold text-foreground">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={handleLogout} disabled={loggingOut} className="mx-auto">
          <LogOut className="size-4" />
          {loggingOut ? "Saindo..." : "Sair"}
        </Button>
        <p className="mt-6 text-xs text-muted-foreground">Contato: suporte@sinery.com.br</p>
      </div>
    </div>
  )
}
