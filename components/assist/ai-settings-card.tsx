"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Settings2, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AiSettingsData } from "@/lib/assist/queries"

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

interface AiSettingsCardProps {
  settings: AiSettingsData
  canEdit: boolean
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

export function AiSettingsCard({ settings, canEdit }: AiSettingsCardProps) {
  const router = useRouter()
  const [form, setForm] = React.useState(settings)
  const [saving, setSaving] = React.useState(false)

  function set<K extends keyof AiSettingsData>(key: K, value: AiSettingsData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch("/api/assist/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, humanFallbackMessage: form.humanFallbackMessage ?? "" }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar as configurações.")
        return
      }
      toast.success("Configurações da Assist atualizadas.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  const disabled = !canEdit || saving

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Settings2 className="size-4.5 text-primary" />
        <CardTitle>Configuração da Assist</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-name">Nome da assistente</Label>
              <Input
                id="ai-name"
                value={form.assistantName}
                disabled={disabled}
                onChange={(e) => set("assistantName", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-tone">Tom</Label>
              <select
                id="ai-tone"
                className={fieldClass}
                value={form.tone}
                disabled={disabled}
                onChange={(e) => set("tone", e.target.value)}
              >
                <option value="professional">Profissional</option>
                <option value="friendly">Amigável</option>
                <option value="casual">Casual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Toggle label="Assist habilitada" checked={form.enabled} disabled={disabled} onChange={(v) => set("enabled", v)} />
            <Toggle label="Transferir para humano" checked={form.fallbackToHuman} disabled={disabled} onChange={(v) => set("fallbackToHuman", v)} />
            <Toggle label="Pode informar preços" checked={form.canAnswerPricing} disabled={disabled} onChange={(v) => set("canAnswerPricing", v)} />
            <Toggle label="Pode agendar" checked={form.canSchedule} disabled={disabled} onChange={(v) => set("canSchedule", v)} />
            <Toggle label="Pode remarcar" checked={form.canReschedule} disabled={disabled} onChange={(v) => set("canReschedule", v)} />
            <Toggle label="Pode cancelar" checked={form.canCancel} disabled={disabled} onChange={(v) => set("canCancel", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-fallback">Mensagem ao transferir para humano</Label>
            <Textarea
              id="ai-fallback"
              value={form.humanFallbackMessage ?? ""}
              disabled={disabled}
              rows={2}
              maxLength={500}
              onChange={(e) => set("humanFallbackMessage", e.target.value)}
              placeholder="Ex.: Vou te transferir para a nossa recepção."
            />
          </div>

          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Salvar configurações
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Somente OWNER e ADMIN podem editar estas configurações.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
