import Link from "next/link"
import { Plus } from "lucide-react"

import { listClinicsForFounder } from "@/lib/platform/founder-queries"
import { clinicAppUrl } from "@/lib/platform/founder-actions"
import { formatCentsBRL } from "@/lib/billing/revenue"
import {
  subscriptionStatusLabels,
  subscriptionStatusTones,
  clinicStatusLabels,
  clinicStatusTones,
} from "@/lib/platform/founder-labels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FounderBadge } from "@/components/founder/founder-badge"
import { ClinicRowActions } from "@/components/founder/clinic-row-actions"

export const metadata = { title: "Clientes — Sinery Founder" }

export default async function FounderClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; subscriptionStatus?: string; overdue?: string }>
}) {
  const sp = await searchParams
  const clinics = await listClinicsForFounder({
    q: sp.q,
    status: sp.status,
    subscriptionStatus: sp.subscriptionStatus,
    overdue: sp.overdue === "1",
  })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground">{clinics.length} clínica(s).</p>
        </div>
        <Button render={<Link href="/founder/clientes/novo">Nova clínica</Link>} nativeButton={false}>
          <Plus className="size-4" />
          Nova clínica
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input name="q" defaultValue={sp.q} placeholder="Nome ou slug" className="w-56" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Status clínica</label>
          <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos</option>
            {Object.entries(clinicStatusLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Assinatura</label>
          <select name="subscriptionStatus" defaultValue={sp.subscriptionStatus ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todas</option>
            {Object.entries(subscriptionStatusLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-foreground">
          <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} />
          Em atraso
        </label>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Clínica</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Assinatura</th>
              <th className="px-3 py-2 font-medium">Plano</th>
              <th className="px-3 py-2 font-medium">Mensal</th>
              <th className="px-3 py-2 font-medium">Vencimento</th>
              <th className="px-3 py-2 font-medium">Atraso</th>
              <th className="px-3 py-2 font-medium">IA / Zap</th>
              <th className="px-3 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clinics.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nenhuma clínica encontrada.</td>
              </tr>
            )}
            {clinics.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link href={`/founder/clientes/${c.id}`} className="font-medium text-foreground hover:text-primary">{c.name}</Link>
                  <div className="text-xs text-muted-foreground">{c.slug}</div>
                </td>
                <td className="px-3 py-2">
                  <FounderBadge label={clinicStatusLabels[c.status] ?? c.status} tone={clinicStatusTones[c.status] ?? "muted"} />
                </td>
                <td className="px-3 py-2">
                  {c.subscriptionStatus ? (
                    <FounderBadge label={subscriptionStatusLabels[c.subscriptionStatus] ?? c.subscriptionStatus} tone={subscriptionStatusTones[c.subscriptionStatus] ?? "muted"} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{c.planName ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.amountInCents > 0 ? formatCentsBRL(c.amountInCents) : "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.nextDueDate ?? "—"}</td>
                <td className="px-3 py-2">{c.overdueDays > 0 ? <span className="text-destructive">{c.overdueDays}d</span> : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {c.aiEnabled ? "IA" : "—"} / {c.whatsappEnabled ? "Zap" : "—"}
                </td>
                <td className="px-3 py-2">
                  <ClinicRowActions clinicId={c.id} status={c.status} url={clinicAppUrl(c.slug)} name={c.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
