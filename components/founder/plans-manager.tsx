"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FounderBadge } from "@/components/founder/founder-badge"
import { formatCentsBRL } from "@/lib/billing/revenue"
import { slugify } from "@/lib/platform/slug"

interface PlanRow {
  id: string
  name: string
  slug: string
  description: string | null
  priceInCents: number
  billingInterval: string
  includesAi: boolean
  includesWhatsapp: boolean
  active: boolean
}

const INTERVAL_LABELS: Record<string, string> = { FREE: "Grátis", MONTHLY: "Mensal", YEARLY: "Anual", ONE_TIME: "Único", CUSTOM: "Custom" }

export function PlansManager({ plans }: { plans: PlanRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PlanDialog trigger={<Button size="sm"><Plus className="size-4" />Novo plano</Button>} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{p.name}</span>
                <FounderBadge label={p.active ? "Ativo" : "Inativo"} tone={p.active ? "success" : "muted"} />
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{formatCentsBRL(p.priceInCents)}</p>
              <p className="text-xs text-muted-foreground">{INTERVAL_LABELS[p.billingInterval] ?? p.billingInterval} · {p.slug}</p>
              <div className="flex gap-1.5 text-xs text-muted-foreground">
                {p.includesAi && <span className="rounded bg-muted px-1.5 py-0.5">IA</span>}
                {p.includesWhatsapp && <span className="rounded bg-muted px-1.5 py-0.5">WhatsApp</span>}
              </div>
              <PlanDialog plan={p} trigger={<Button size="sm" variant="outline" className="mt-1 w-fit"><Pencil className="size-3.5" />Editar</Button>} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PlanDialog({ plan, trigger }: { plan?: PlanRow; trigger: React.ReactElement }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get("name"),
      slug: fd.get("slug"),
      description: fd.get("description"),
      priceInReais: Number(fd.get("priceInReais")),
      billingInterval: fd.get("billingInterval"),
      includesAi: fd.get("includesAi") === "on",
      includesWhatsapp: fd.get("includesWhatsapp") === "on",
      active: fd.get("active") === "on",
    }
    try {
      const res = await fetch(plan ? `/api/founder/plans/${plan.id}` : "/api/founder/plans", {
        method: plan ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Falha ao salvar.")
        setLoading(false)
        return
      }
      toast.success(plan ? "Plano atualizado." : "Plano criado.")
      setOpen(false)
      router.refresh()
    } catch {
      setError("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{plan ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1"><Label>Nome</Label><Input name="name" required defaultValue={plan?.name} onChange={(e) => { const s = document.querySelector<HTMLInputElement>('input[name="slug"]'); if (s && !plan) s.value = slugify(e.target.value) }} /></div>
            <div className="flex flex-col gap-1"><Label>Slug</Label><Input name="slug" required defaultValue={plan?.slug} /></div>
          </div>
          <div className="flex flex-col gap-1"><Label>Descrição</Label><Input name="description" defaultValue={plan?.description ?? ""} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1"><Label>Preço (R$)</Label><Input name="priceInReais" type="number" step="0.01" min="0" defaultValue={plan ? plan.priceInCents / 100 : 0} /></div>
            <div className="flex flex-col gap-1">
              <Label>Intervalo</Label>
              <select name="billingInterval" defaultValue={plan?.billingInterval ?? "MONTHLY"} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {Object.entries(INTERVAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" name="includesAi" defaultChecked={plan?.includesAi} /> Inclui IA</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="includesWhatsapp" defaultChecked={plan?.includesWhatsapp} /> Inclui WhatsApp</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="active" defaultChecked={plan ? plan.active : true} /> Ativo</label>
          </div>
          <Button type="submit" disabled={loading} className="mt-1">{loading ? "Salvando..." : "Salvar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
