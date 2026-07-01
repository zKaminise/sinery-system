import { User } from "lucide-react"

import { cn } from "@/lib/utils"
import { getAuditActionLabel, getAuditActionTone } from "@/lib/audit-actions"
import { EmptyState } from "@/components/common/empty-state"
import { ScrollText } from "lucide-react"

export interface AuditLogRow {
  id: string
  createdAt: Date
  action: string
  entity: string
  description: string | null
  userName: string | null
}

const toneStyles: Record<ReturnType<typeof getAuditActionTone>, string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  info: "bg-secondary/10 text-secondary",
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

export function AuditLogTable({ logs }: { logs: AuditLogRow[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="Nenhum registro encontrado"
        description="Não há eventos de auditoria para os filtros selecionados."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Data/hora</th>
            <th className="px-4 py-2.5 font-medium">Ação</th>
            <th className="px-4 py-2.5 font-medium">Entidade</th>
            <th className="px-4 py-2.5 font-medium">Descrição</th>
            <th className="px-4 py-2.5 font-medium">Usuário</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {formatDateTime(log.createdAt)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    toneStyles[getAuditActionTone(log.action)]
                  )}
                >
                  {getAuditActionLabel(log.action)}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {log.entity}
              </td>
              <td className="max-w-md px-4 py-3 text-foreground">
                {log.description ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {log.userName ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <User className="size-3.5" />
                    {log.userName}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">Sistema</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
