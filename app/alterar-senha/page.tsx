import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"

import { getCurrentUser } from "@/lib/current-user"
import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Alterar senha — Sinery System",
}

export default async function AlterarSenhaPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 size-80 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-secondary/15 blur-3xl"
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <ShieldCheck className="size-6" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Sinery
            </span>
            <span className="text-xs text-muted-foreground">System</span>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex flex-col gap-1 text-center">
              <h1 className="text-xl font-semibold text-foreground">
                Crie uma nova senha
              </h1>
              <p className="text-sm text-muted-foreground">
                Olá, {user.name.split(" ")[0]}. Por segurança, crie uma nova senha
                para continuar.
              </p>
            </div>

            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
