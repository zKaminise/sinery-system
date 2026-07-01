"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Lock, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { aiTones, appointmentSlots } from "@/lib/validators/settings"
import type { SettingsOperation } from "@/components/settings/types"

const BR_TIMEZONES = [
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Belem",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Rio_Branco",
  "America/Noronha",
]

const aiToneLabels: Record<string, string> = {
  professional: "Profissional",
  friendly: "Amigável",
  formal: "Formal",
}

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30"

const hourOptions = Array.from({ length: 24 }, (_, h) => h)

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`
}

export function OperationSettingsForm({
  settings,
  canManage,
}: {
  settings: SettingsOperation
  canManage: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    timezone: settings.timezone,
    businessStartHour: settings.businessStartHour,
    businessEndHour: settings.businessEndHour,
    appointmentSlotMinutes: settings.appointmentSlotMinutes,
    allowAiScheduling: settings.allowAiScheduling,
    allowAiRescheduling: settings.allowAiRescheduling,
    allowAiCancellation: settings.allowAiCancellation,
    aiTone: settings.aiTone,
  })

  const timezoneOptions = BR_TIMEZONES.includes(form.timezone)
    ? BR_TIMEZONES
    : [form.timezone, ...BR_TIMEZONES]

  const disabled = !canManage || loading

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return

    if (form.businessStartHour >= form.businessEndHour) {
      toast.error("O horário de início deve ser menor que o de término.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/settings/operation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar.")
        return
      }
      toast.success("Configurações operacionais atualizadas.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Expediente e agendamento</CardTitle>
          <CardDescription>
            Define fuso horário, horário de funcionamento e o intervalo padrão da agenda.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="timezone">Fuso horário</Label>
            <select id="timezone" className={selectClass} value={form.timezone} disabled={disabled}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}>
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startHour">Início do expediente</Label>
            <select id="startHour" className={selectClass} value={form.businessStartHour} disabled={disabled}
              onChange={(e) => setForm((p) => ({ ...p, businessStartHour: Number(e.target.value) }))}>
              {hourOptions.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endHour">Fim do expediente</Label>
            <select id="endHour" className={selectClass} value={form.businessEndHour} disabled={disabled}
              onChange={(e) => setForm((p) => ({ ...p, businessEndHour: Number(e.target.value) }))}>
              {hourOptions.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot">Intervalo de agendamento</Label>
            <select id="slot" className={selectClass} value={form.appointmentSlotMinutes} disabled={disabled}
              onChange={(e) => setForm((p) => ({ ...p, appointmentSlotMinutes: Number(e.target.value) }))}>
              {appointmentSlots.map((m) => (
                <option key={m} value={m}>{m} minutos</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4.5 text-secondary" />
            Sinery Assist
          </CardTitle>
          <CardDescription>
            Prepara os limites de atuação da IA. Estas opções ainda não ativam nenhuma
            automação real — apenas registram a preferência da clínica.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleRow
            label="Tom da IA"
            description="Como a assistente se comunica com os pacientes."
            control={
              <select
                aria-label="Tom da IA"
                className={cn(selectClass, "w-40")}
                value={form.aiTone}
                disabled={disabled}
                onChange={(e) => setForm((p) => ({ ...p, aiTone: e.target.value }))}
              >
                {aiTones.map((t) => (
                  <option key={t} value={t}>{aiToneLabels[t]}</option>
                ))}
              </select>
            }
          />
          <SwitchRow
            label="Permitir agendamento por IA"
            checked={form.allowAiScheduling}
            disabled={disabled}
            onChange={(v) => setForm((p) => ({ ...p, allowAiScheduling: v }))}
          />
          <SwitchRow
            label="Permitir remarcação por IA"
            checked={form.allowAiRescheduling}
            disabled={disabled}
            onChange={(v) => setForm((p) => ({ ...p, allowAiRescheduling: v }))}
          />
          <SwitchRow
            label="Permitir cancelamento por IA"
            checked={form.allowAiCancellation}
            disabled={disabled}
            onChange={(v) => setForm((p) => ({ ...p, allowAiCancellation: v }))}
          />
        </CardContent>
        {canManage ? (
          <CardFooter className="justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Salvar configurações
            </Button>
          </CardFooter>
        ) : (
          <CardFooter className="text-sm text-muted-foreground">
            <Lock className="size-4" />
            Você tem acesso somente leitura a esta seção.
          </CardFooter>
        )}
      </Card>
    </form>
  )
}

function ToggleRow({
  label,
  description,
  control,
}: {
  label: string
  description?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      {control}
    </div>
  )
}

function SwitchRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}
