import { Sparkles } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function AssistCard() {
  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
            <Sparkles className="size-5.5" />
          </div>
          <div className="max-w-xl">
            <h3 className="text-sm font-semibold text-foreground">Sinery Assist</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A Sinery Assist ajuda sua clínica a responder pacientes, consultar
              horários e criar agendamentos de forma inteligente.
            </p>
          </div>
        </div>
        <Button variant="secondary" className="shrink-0">
          Conhecer a Sinery Assist
        </Button>
      </CardContent>
    </Card>
  )
}
