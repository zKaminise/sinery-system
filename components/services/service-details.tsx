"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, CheckCircle2, XCircle, Timer, Tag, CalendarClock, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ServiceStatusBadge } from "@/components/services/service-status-badge"
import { ServiceFormDialog } from "@/components/services/service-form-dialog"
import { formatPriceFromCents } from "@/lib/utils"
import type { ServiceDetail } from "@/components/services/types"
import type { ServiceStatus } from "@/lib/generated/prisma/client"

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  )
}

interface ServiceDetailsProps {
  service: ServiceDetail
  canEdit: boolean
  canChangeStatus: boolean
}

export function ServiceDetails({ service, canEdit, canChangeStatus }: ServiceDetailsProps) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function toggleStatus() {
    const nextStatus: ServiceStatus = service.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setBusy(true)
    try {
      const response = await fetch(`/api/services/${service.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o serviço.")
        return
      }
      toast.success(nextStatus === "ACTIVE" ? "Serviço ativado." : "Serviço inativado.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">{service.name}</h2>
          <ServiceStatusBadge status={service.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setFormOpen(true)} disabled={busy}>
              <Pencil className="size-4" /> Editar
            </Button>
          )}
          {canChangeStatus && (
            <Button variant="outline" disabled={busy} onClick={toggleStatus}>
              {service.status === "ACTIVE" ? (
                <>
                  <XCircle className="size-4" /> Inativar
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" /> Ativar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do serviço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoRow icon={Timer} label="Duração" value={`${service.durationMinutes} minutos`} />
          <InfoRow icon={Tag} label="Preço estimado" value={formatPriceFromCents(service.priceInCents)} />
          <InfoRow icon={CalendarClock} label="Criado em" value={formatDateTime(service.createdAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Descrição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {service.description && service.description.length > 0
              ? service.description
              : "Nenhuma descrição registrada."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4.5 text-primary" />
            Profissionais vinculados
          </CardTitle>
          <CardDescription>
            Para vincular ou remover profissionais deste serviço, acesse a página de
            detalhes do profissional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {service.professionals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum profissional vinculado a este serviço ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {service.professionals.map((professional) => (
                <Link
                  key={professional.linkId}
                  href={`/profissionais/${professional.professionalId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{professional.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {professional.specialty ?? "Especialidade não informada"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="edit"
        initial={{
          id: service.id,
          name: service.name,
          description: service.description ?? "",
          durationMinutes: String(service.durationMinutes),
          priceInReais: service.priceInCents != null ? (service.priceInCents / 100).toFixed(2) : "",
        }}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  )
}
