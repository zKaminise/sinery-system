import { Building2, ArrowRight } from "lucide-react"

import { SineryWordmark } from "@/components/brand/sinery-brand"

/**
 * Shown at the ROOT host (e.g. hml.app.sinery.com.br / app.sinery.com.br) when
 * subdomain enforcement is ON: clinic users must sign in on their own clinic
 * address, so we explain that instead of showing a login form here.
 */
export function RootLoginNotice({ exampleUrl }: { exampleUrl: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col gap-1.5">
          <SineryWordmark priority className="h-10" />
          <span className="text-xs text-muted-foreground">System — tecnologia para clínicas</span>
        </div>

        <div className="mt-8 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Building2 className="size-6" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
          Acesse pelo endereço da sua clínica
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este é o endereço principal do Sinery System. O login de cada clínica acontece no seu
          próprio endereço (subdomínio), por exemplo:
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <code className="truncate font-mono text-foreground">{exampleUrl}</code>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Não sabe o endereço da sua clínica? Fale com o administrador responsável na sua clínica.
        </p>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Sinery © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
