"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FounderBadge } from "@/components/founder/founder-badge"
import { formatCentsBRL } from "@/lib/billing/revenue"
import { invoiceStatusLabels, invoiceStatusTones } from "@/lib/platform/founder-labels"

interface InvoiceRow {
  id: string
  clinicName: string
  clinicSlug: string
  amountInCents: number
  dueDate: string
  status: string
  paidAt: string | null
  paymentMethod: string
}

export function BillingInvoices({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function invoiceAction(id: string, action: "mark_paid" | "mark_overdue" | "cancel", okMsg: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/founder/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      const data = await res.json()
      if (!res.ok) toast.error(data.error ?? "Falha.")
      else { toast.success(okMsg); router.refresh() }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setBusy(false)
    }
  }

  async function recalcAll() {
    setBusy(true)
    try {
      const res = await fetch("/api/founder/billing/recalc", { method: "POST" })
      const data = await res.json()
      if (!res.ok) toast.error(data.error ?? "Falha.")
      else { toast.success(`Recalculado: ${data.data.processed} clínica(s), ${data.data.suspended} suspensa(s).`); router.refresh() }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" disabled={busy} onClick={recalcAll}>
          <RefreshCw className="size-4" /> Recalcular status de todas
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Clínica</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Vencimento</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Pago em</th>
              <th className="px-3 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhuma fatura.</td></tr>}
            {invoices.map((inv) => {
              const open = inv.status === "PENDING" || inv.status === "OVERDUE"
              return (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2"><Link href={`/founder/clientes`} className="text-foreground hover:text-primary">{inv.clinicName}</Link><div className="text-xs text-muted-foreground">{inv.clinicSlug}</div></td>
                  <td className="px-3 py-2 font-medium text-foreground">{formatCentsBRL(inv.amountInCents)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{inv.dueDate}</td>
                  <td className="px-3 py-2"><FounderBadge label={invoiceStatusLabels[inv.status] ?? inv.status} tone={invoiceStatusTones[inv.status] ?? "muted"} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{inv.paidAt ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {open && (
                        <>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => invoiceAction(inv.id, "mark_paid", "Pagamento registrado.")}>Pago</Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => invoiceAction(inv.id, "mark_overdue", "Marcada como vencida.")}>Vencida</Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => invoiceAction(inv.id, "cancel", "Cancelada.")}>Cancelar</Button>
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
    </div>
  )
}
