"use client"

import * as React from "react"
import { Plus, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AssistSimulationList } from "@/components/assist/assist-simulation-list"
import { AssistChat } from "@/components/assist/assist-chat"
import { AssistContextPanel } from "@/components/assist/assist-context-panel"
import { NewSimulationDialog } from "@/components/assist/new-simulation-dialog"
import type { AssistSimulationListItem, AssistSimulationDetail } from "@/lib/assist/queries"

interface AssistPageClientProps {
  items: AssistSimulationListItem[]
  selected: AssistSimulationDetail | null
  timeZone: string
  patients: { id: string; name: string }[]
  canUse: boolean
}

export function AssistPageClient({ items, selected, timeZone, patients, canUse }: AssistPageClientProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const buildHref = React.useCallback((id: string) => `/assist?c=${id}`, [])
  const backHref = "/assist"

  return (
    <div className="flex flex-col gap-3">
      {canUse && (
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Nova simulação
          </Button>
        </div>
      )}

      <div className="grid h-[calc(100vh-22rem)] min-h-[480px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(260px,300px)_1fr] xl:grid-cols-[minmax(260px,300px)_1fr_minmax(240px,280px)]">
        <div className={cn("flex min-h-0 flex-col border-r border-border", selected ? "hidden lg:flex" : "flex")}>
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">Simulações</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AssistSimulationList items={items} selectedId={selected?.id} timeZone={timeZone} buildHref={buildHref} />
          </div>
        </div>

        <div className={cn("min-h-0 flex-col", selected ? "flex" : "hidden lg:flex")}>
          {selected ? (
            <AssistChat simulation={selected} timeZone={timeZone} canUse={canUse} backHref={backHref} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                <Sparkles className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">Selecione uma simulação</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Escolha uma conversa à esquerda ou crie uma nova simulação para testar a Sinery Assist.
              </p>
            </div>
          )}
        </div>

        {selected && (
          <div className="hidden min-h-0 overflow-y-auto border-l border-border xl:block">
            <AssistContextPanel simulation={selected} />
          </div>
        )}
      </div>

      {canUse && (
        <NewSimulationDialog open={dialogOpen} onOpenChange={setDialogOpen} patients={patients} />
      )}
    </div>
  )
}
