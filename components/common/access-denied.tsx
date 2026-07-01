import Link from "next/link"
import { ShieldX } from "lucide-react"

import { Button } from "@/components/ui/button"

interface AccessDeniedProps {
  title?: string
  description?: string
}

export function AccessDenied({
  title = "Acesso negado",
  description = "Você não tem permissão para acessar esta área. Fale com o responsável pela clínica se precisar de acesso.",
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/dashboard">Voltar ao dashboard</Link>}
      />
    </div>
  )
}
