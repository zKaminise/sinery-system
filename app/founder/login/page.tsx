import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentPlatformUser } from "@/lib/platform/current-platform-user"
import { SineryWordmark } from "@/components/brand/sinery-brand"
import { FounderLoginForm } from "@/components/founder/founder-login-form"

export const metadata: Metadata = {
  title: "Sinery Founder — Entrar",
  robots: { index: false, follow: false },
}

export default async function FounderLoginPage() {
  // Already authenticated → straight to the panel.
  const user = await getCurrentPlatformUser()
  if (user) redirect("/founder")

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col gap-1.5">
          <SineryWordmark priority className="h-9" />
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Founder · painel interno</span>
        </div>
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Entrar na plataforma</h1>
        <p className="mb-6 text-sm text-muted-foreground">Acesso restrito à equipe da Sinery.</p>
        <FounderLoginForm />
      </div>
    </div>
  )
}
