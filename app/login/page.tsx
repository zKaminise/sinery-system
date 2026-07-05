import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"
import { LoginShowcase } from "@/components/auth/login-showcase"
import { RootLoginNotice } from "@/components/auth/root-login-notice"
import { SineryWordmark } from "@/components/brand/sinery-brand"
import { getHostTenant, isSubdomainEnforced } from "@/lib/tenant/tenant-context"
import { resolveAppEnv } from "@/lib/env/env-readiness"
import { evaluateRootLoginAccess } from "@/lib/tenant/tenant-security"
import { buildTenantUrl } from "@/lib/tenant/tenant-url"

export const metadata: Metadata = {
  title: "Entrar — Sinery System",
  description: "Acesse o Sinery System, o sistema operacional inteligente para clínicas.",
}

export default async function LoginPage() {
  // At the ROOT host in staging/production (when enforced), clinic users must
  // sign in on their clinic subdomain — show an explanatory screen, not a form.
  const hostTenant = await getHostTenant()
  const rootBlock = evaluateRootLoginAccess({
    appEnv: resolveAppEnv(),
    hostKind: hostTenant.kind,
    enforced: isSubdomainEnforced(),
  })
  if (rootBlock.blocked) {
    return <RootLoginNotice exampleUrl={buildTenantUrl("sua-clinica")} />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:grid-cols-2 lg:min-h-[620px]">
        {/* Left — sign-in form */}
        <div className="relative flex flex-col justify-center px-6 py-10 sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-16 size-64 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col gap-8">
            <div className="flex flex-col gap-1.5">
              <SineryWordmark priority className="h-10" />
              <span className="text-xs text-muted-foreground">
                System — tecnologia para clínicas
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Entrar</h1>
              <p className="text-sm text-muted-foreground">Use seu e-mail e senha para acessar sua operação.</p>
            </div>

            <LoginForm />

            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Primeiro acesso?</span> Use a senha provisória fornecida pela
              sua clínica — você definirá uma nova logo após entrar.
            </p>
          </div>

          <p className="relative z-10 mt-8 text-center text-xs text-muted-foreground">
            Sinery © {new Date().getFullYear()}
          </p>
        </div>

        {/* Right — product showcase (hidden on small screens) */}
        <LoginShowcase />
      </div>
    </div>
  )
}
