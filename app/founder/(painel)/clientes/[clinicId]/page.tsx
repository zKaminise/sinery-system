import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getClinicDetailForFounder } from "@/lib/platform/founder-queries"
import { clinicAppUrl } from "@/lib/platform/founder-actions"
import { formatCentsBRL } from "@/lib/billing/revenue"
import { maskWhatsAppId } from "@/lib/whatsapp/whatsapp-mask"
import {
  clinicStatusLabels,
  clinicStatusTones,
  subscriptionStatusLabels,
  subscriptionStatusTones,
} from "@/lib/platform/founder-labels"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FounderBadge } from "@/components/founder/founder-badge"
import { ClinicRowActions } from "@/components/founder/clinic-row-actions"
import { ClinicBillingPanel } from "@/components/founder/clinic-billing-panel"
import { ResendAccessButton } from "@/components/founder/resend-access-button"

export const metadata = { title: "Cliente — Sinery Founder" }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export default async function ClinicDetailPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params
  const detail = await getClinicDetailForFounder(clinicId)
  if (!detail) notFound()

  const { clinic, counts, owners, invoices, events } = detail
  const sub = clinic.subscription
  const url = clinicAppUrl(clinic.slug)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Link href="/founder/clientes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Clientes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{clinic.name}</h2>
            <FounderBadge label={clinicStatusLabels[clinic.status] ?? clinic.status} tone={clinicStatusTones[clinic.status] ?? "muted"} />
          </div>
          <ClinicRowActions clinicId={clinic.id} status={clinic.status} url={url} name={clinic.name} />
        </div>
        <p className="text-sm text-muted-foreground">{clinic.slug} · <span className="font-mono text-xs">{url}</span></p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Visão geral</CardTitle></CardHeader>
          <CardContent>
            <Row label="Segmento" value={clinic.segment} />
            <Row label="E-mail" value={clinic.email ?? "—"} />
            <Row label="Usuários ativos" value={counts.usersCount} />
            <Row label="Pacientes" value={counts.patientsCount} />
            <Row label="Profissionais" value={counts.professionalsCount} />
            <Row label="Serviços" value={counts.servicesCount} />
            <Row label="Consultas no mês" value={counts.apptThisMonth} />
            <Row label="Conversas no mês" value={counts.convThisMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Comercial</CardTitle></CardHeader>
          <CardContent>
            <Row label="Plano" value={sub?.plan?.name ?? "Sem plano"} />
            <Row
              label="Assinatura"
              value={sub ? <FounderBadge label={subscriptionStatusLabels[sub.status] ?? sub.status} tone={subscriptionStatusTones[sub.status] ?? "muted"} /> : "—"}
            />
            <Row label="Valor" value={sub && sub.amountInCents > 0 ? formatCentsBRL(sub.amountInCents) : "—"} />
            <Row label="Método" value={sub?.paymentMethod ?? "—"} />
            <Row label="Próximo vencimento" value={sub?.nextDueDate ? sub.nextDueDate.toISOString().slice(0, 10) : "—"} />
            <Row label="Tolerância" value={sub ? `${sub.graceDays} dias` : "—"} />
            <Row label="Em atraso desde" value={sub?.overdueSince ? sub.overdueSince.toISOString().slice(0, 10) : "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Faturas & pagamentos</CardTitle></CardHeader>
        <CardContent>
          <ClinicBillingPanel
            clinicId={clinic.id}
            invoices={invoices.map((i) => ({
              id: i.id,
              amountInCents: i.amountInCents,
              dueDate: i.dueDate.toISOString().slice(0, 10),
              status: i.status,
              paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
              paymentMethod: i.paymentMethod,
            }))}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Responsáveis</CardTitle>
            <ResendAccessButton clinicId={clinic.id} />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {owners.length === 0 && <p className="text-sm text-muted-foreground">Nenhum.</p>}
            {owners.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{o.name}</p>
                  <p className="text-xs text-muted-foreground">{o.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">{o.role}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">IA / WhatsApp</CardTitle></CardHeader>
          <CardContent>
            <Row label="IA habilitada" value={clinic.aiSettings?.enabled ? "Sim" : "Não"} />
            <Row label="Uso de IA (mês)" value={counts.aiUsageMonth} />
            <Row label="WhatsApp habilitado" value={clinic.whatsAppIntegration?.enabled ? "Sim" : "Não"} />
            <Row label="Phone Number ID" value={maskWhatsAppId(clinic.whatsAppIntegration?.phoneNumberId ?? null)} />
            <Row label="Última msg recebida" value={clinic.whatsAppIntegration?.lastMessageReceivedAt ? clinic.whatsAppIntegration.lastMessageReceivedAt.toISOString().slice(0, 10) : "—"} />
            <Row label="Última msg enviada" value={clinic.whatsAppIntegration?.lastMessageSentAt ? clinic.whatsAppIntegration.lastMessageSentAt.toISOString().slice(0, 10) : "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Eventos comerciais</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {events.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento.</p>}
          {events.map((ev) => (
            <div key={ev.id} className="flex justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0">
              <span className="text-foreground">{ev.type}{ev.message ? ` — ${ev.message}` : ""}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{ev.createdAt.toISOString().slice(0, 10)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Configuração técnica</CardTitle></CardHeader>
        <CardContent>
          <Row label="clinicId" value={<span className="font-mono text-xs">{clinic.id}</span>} />
          <Row label="Slug" value={clinic.slug} />
          <Row label="Status" value={clinic.status} />
          <Row label="Criada em" value={clinic.createdAt.toISOString().slice(0, 10)} />
        </CardContent>
      </Card>
    </div>
  )
}
