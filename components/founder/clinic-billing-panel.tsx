"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FounderBadge } from "@/components/founder/founder-badge"
import { formatCentsBRL } from "@/lib/billing/revenue"
import { invoiceStatusLabels, invoiceStatusTones } from "@/lib/platform/founder-labels"

interface InvoiceRow {
  id: string
  amountInCents: number
  dueDate: string
  status: string
  paidAt: string | null
  paymentMethod: string
}

export function ClinicBillingPanel({ clinicId, invoices }: { clinicId: string; invoices: InvoiceRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function post(url: string, body: unknown, method: "POST" | "PATCH", okMsg: string) {
    setBusy(true)
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) toast.error(data.error ?? "Falha na ação.")
      else {
        toast.success(okMsg)
        router.refresh()
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setBusy(false)
    }
  }

  async function createInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await post(
      `/api/founder/clinics/${clinicId}/invoices`,
      { amountInReais: Number(fd.get("amountInReais")), dueDate: fd.get("dueDate"), paymentMethod: fd.get("paymentMethod") },
      "POST",
      "Fatura criada."
    )
    ;(e.target as HTMLFormElement).reset()
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={createInvoice} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Valor (R$)</label>
          <Input name="amountInReais" type="number" step="0.01" min="0" required className="w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Vencimento</label>
          <Input name="dueDate" type="date" required className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Método</label>
          <select name="paymentMethod" defaultValue="MANUAL" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="MANUAL">Manual</option>
            <option value="PIX">Pix</option>
            <option value="BOLETO">Boleto</option>
            <option value="CREDIT_CARD">Cartão</option>
            <option value="BANK_TRANSFER">Transferência</option>
          </select>
        </div>
        <Button type="submit" size="sm" disabled={busy}>Criar fatura</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Vencimento</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Pago em</th>
              <th className="px-3 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhuma fatura.</td></tr>
            )}
            {invoices.map((inv) => {
              const open = inv.status === "PENDING" || inv.status === "OVERDUE"
              return (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{formatCentsBRL(inv.amountInCents)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{inv.dueDate}</td>
                  <td className="px-3 py-2"><FounderBadge label={invoiceStatusLabels[inv.status] ?? inv.status} tone={invoiceStatusTones[inv.status] ?? "muted"} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{inv.paidAt ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {open && (
                        <>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => post(`/api/founder/invoices/${inv.id}`, { action: "mark_paid" }, "PATCH", "Pagamento registrado.")}>Pago</Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => post(`/api/founder/invoices/${inv.id}`, { action: "mark_overdue" }, "PATCH", "Marcada como vencida.")}>Vencida</Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => post(`/api/founder/invoices/${inv.id}`, { action: "cancel" }, "PATCH", "Fatura cancelada.")}>Cancelar</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Lembretes (mock — Resend futuro):</span>
        {(["PAYMENT_DUE_SOON", "PAYMENT_OVERDUE", "PAYMENT_SUSPENSION_WARNING", "PAYMENT_CONFIRMED"] as const).map((t) => (
          <Button key={t} size="sm" variant="ghost" disabled={busy} onClick={() => post(`/api/founder/clinics/${clinicId}/notify`, { type: t }, "POST", "Lembrete registrado (mock).")}>
            {t.replace("PAYMENT_", "").replaceAll("_", " ").toLowerCase()}
          </Button>
        ))}
      </div>
    </div>
  )
}
