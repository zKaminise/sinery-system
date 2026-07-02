"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ClipboardList, Link2, Unlink, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ProfessionalLinkedService } from "@/components/professionals/types"

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

interface AvailableService {
  id: string
  name: string
}

interface ProfessionalServicesManagerProps {
  professionalId: string
  linkedServices: ProfessionalLinkedService[]
  availableServices: AvailableService[]
  canManage: boolean
}

export function ProfessionalServicesManager({
  professionalId,
  linkedServices,
  availableServices,
  canManage,
}: ProfessionalServicesManagerProps) {
  const router = useRouter()
  const [selectedServiceId, setSelectedServiceId] = React.useState("")
  const [linking, setLinking] = React.useState(false)
  const [busyServiceId, setBusyServiceId] = React.useState<string | null>(null)

  const linkedIds = new Set(linkedServices.map((s) => s.serviceId))
  const linkableServices = availableServices.filter((s) => !linkedIds.has(s.id))

  async function linkService() {
    if (!selectedServiceId) return
    setLinking(true)
    try {
      const response = await fetch(`/api/professionals/${professionalId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: selectedServiceId }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível vincular o serviço.")
        return
      }
      toast.success("Serviço vinculado.")
      setSelectedServiceId("")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLinking(false)
    }
  }

  async function unlinkService(serviceId: string) {
    setBusyServiceId(serviceId)
    try {
      const response = await fetch(`/api/professionals/${professionalId}/services/${serviceId}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível remover o vínculo.")
        return
      }
      toast.success("Vínculo removido.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusyServiceId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-4.5 text-primary" />
          Serviços vinculados
        </CardTitle>
        <CardDescription>
          Selecione quais serviços este profissional realiza. A agenda usará essa
          informação para sugerir horários corretamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {linkedServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço vinculado ainda.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linkedServices.map((service) => (
              <div
                key={service.linkId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{service.name}</span>
                  <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                    {service.durationMinutes} min
                  </Badge>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busyServiceId === service.serviceId}
                    onClick={() => unlinkService(service.serviceId)}
                    aria-label="Remover vínculo"
                  >
                    <Unlink className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              className={selectClass}
              value={selectedServiceId}
              disabled={linking || linkableServices.length === 0}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              aria-label="Selecionar serviço para vincular"
            >
              <option value="">
                {linkableServices.length === 0 ? "Todos os serviços já vinculados" : "Selecione um serviço..."}
              </option>
              {linkableServices.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedServiceId || linking}
              onClick={linkService}
            >
              {linking ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Vincular
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
