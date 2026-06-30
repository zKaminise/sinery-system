import type { LucideIcon } from "lucide-react"
import { Construction } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface PagePlaceholderProps {
  title: string
  description: string
  icon?: LucideIcon
}

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: PagePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5.5" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Construction className="size-6" />
          </div>
          <CardHeader className="gap-1 p-0">
            <CardTitle className="text-base">
              Este módulo será implementado nas próximas etapas
            </CardTitle>
            <CardDescription className="max-w-md">
              Estamos construindo a Sinery por partes. A tela de {title.toLowerCase()}{" "}
              ganhará funcionalidade completa em uma próxima atualização do sistema.
            </CardDescription>
          </CardHeader>
        </CardContent>
      </Card>
    </div>
  )
}
