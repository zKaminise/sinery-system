import { redirect } from "next/navigation"

import { getCurrentPlatformUser } from "@/lib/platform/current-platform-user"
import { SineryWordmark } from "@/components/brand/sinery-brand"
import { FounderChangePasswordForm } from "@/components/founder/founder-change-password-form"

export const metadata = { title: "Trocar senha — Sinery Founder", robots: { index: false } }

export default async function FounderChangePasswordPage() {
  const user = await getCurrentPlatformUser()
  if (!user) redirect("/api/founder/auth/clear-session")

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col gap-1.5">
          <SineryWordmark priority className="h-9" />
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Founder</span>
        </div>
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Definir nova senha</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {user.temporaryPassword ? "Você está usando uma senha provisória. Defina uma nova senha para continuar." : "Atualize sua senha de acesso."}
        </p>
        <FounderChangePasswordForm />
      </div>
    </div>
  )
}
