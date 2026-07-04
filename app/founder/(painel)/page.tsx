import Link from "next/link"
import { Building2, TrendingUp, AlertTriangle, Sparkles, MessageCircle, Plus } from "lucide-react"

import { getFounderDashboard } from "@/lib/platform/founder-queries"
import { formatCentsBRL } from "@/lib/billing/revenue"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Visão geral — Sinery Founder" }

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default async function FounderDashboardPage() {
  const data = await getFounderDashboard()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Visão geral</h2>
          <p className="text-sm text-muted-foreground">Panorama comercial e operacional da Sinery.</p>
        </div>
        <Button render={<Link href="/founder/clientes/novo">Nova clínica</Link>} nativeButton={false}>
          <Plus className="size-4" />
          Nova clínica
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <CardTitle className="text-base">Clientes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Total" value={data.clinics.total} />
          <Stat label="Ativas" value={data.clinics.active} />
          <Stat label="Em trial" value={data.clinics.trialing} />
          <Stat label="Em atraso" value={data.clinics.overdue} />
          <Stat label="Suspensas" value={data.clinics.suspended} />
          <Stat label="Canceladas" value={data.clinics.cancelled} />
          <Stat label="Novas (30d)" value={data.clinics.createdLast30Days} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <CardTitle className="text-base">Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Stat label="MRR estimado" value={formatCentsBRL(data.revenue.mrrInCents)} />
          <Stat label="ARR estimado" value={formatCentsBRL(data.revenue.arrInCents)} />
          <Stat label="Prevista no mês" value={formatCentsBRL(data.revenue.predictedThisMonthInCents)} />
          <Stat label="Recebida no mês" value={formatCentsBRL(data.revenue.receivedThisMonthInCents)} />
          <Stat label="Em atraso" value={formatCentsBRL(data.revenue.overdueInCents)} />
          <Stat label="Faturas pendentes" value={data.revenue.pendingInvoices} />
          <Stat label="Faturas vencidas" value={data.revenue.overdueInvoices} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <CardTitle className="text-base">Operação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="WhatsApp configurado" value={data.operation.whatsappConfigured} />
          <Stat label="IA habilitada" value={data.operation.aiEnabled} />
          <Stat label="Uso de IA hoje" value={data.operation.aiUsedToday} hint="clínicas distintas" />
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-foreground">
        <AlertTriangle className="size-4 shrink-0 text-warning" />
        Este painel usa registros internos manuais. A integração automática de pagamentos (Asaas) e o envio de e-mails (Resend)
        serão implementados futuramente. Nenhum dado sensível de pacientes é exibido aqui — apenas agregados.
      </p>

      <p className="text-xs text-muted-foreground">
        <MessageCircle className="mr-1 inline size-3" />
        Precisa criar um cliente? <Link href="/founder/clientes/novo" className="text-primary underline">Cadastrar nova clínica</Link>.
      </p>
    </div>
  )
}
