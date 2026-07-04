import { AlertTriangle } from "lucide-react"

import { getBillingOverview } from "@/lib/platform/founder-queries"
import { formatCentsBRL } from "@/lib/billing/revenue"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BillingInvoices } from "@/components/founder/billing-invoices"

export const metadata = { title: "Financeiro — Sinery Founder" }

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

export default async function FounderBillingPage() {
  const data = await getBillingOverview()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Financeiro</h2>
        <p className="text-sm text-muted-foreground">Registros internos manuais (sem integração de pagamento).</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Recebida no mês" value={formatCentsBRL(data.receivedThisMonthInCents)} />
        <Stat label="Prevista no mês" value={formatCentsBRL(data.predictedThisMonthInCents)} />
        <Stat label="Em atraso" value={formatCentsBRL(data.overdueInCents)} />
        <Stat label="MRR" value={formatCentsBRL(data.mrrInCents)} />
        <Stat label="ARR" value={formatCentsBRL(data.arrInCents)} />
        <Stat label="Pendentes" value={data.counts.pending} />
        <Stat label="Vencidas" value={data.counts.overdue} />
      </div>

      <p className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-foreground">
        <AlertTriangle className="size-4 shrink-0 text-warning" />
        Este painel usa registros internos manuais. A integração automática de pagamentos (Asaas/Stripe) será implementada futuramente.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">Faturas</CardTitle></CardHeader>
        <CardContent>
          <BillingInvoices invoices={data.invoices} />
        </CardContent>
      </Card>
    </div>
  )
}
