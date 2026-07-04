import { listCheckoutSessions } from "@/lib/platform/founder-queries"
import { formatCentsBRL } from "@/lib/billing/revenue"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FounderBadge } from "@/components/founder/founder-badge"
import type { BadgeTone } from "@/lib/platform/founder-labels"

export const metadata = { title: "Checkouts — Sinery Founder" }

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "muted",
  AWAITING_PAYMENT: "warning",
  PAID: "info",
  PROVISIONING: "info",
  PROVISIONED: "success",
  FAILED: "danger",
  CANCELLED: "muted",
  EXPIRED: "muted",
}

export default async function FounderCheckoutsPage() {
  const rows = await listCheckoutSessions()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Checkouts</h2>
        <p className="text-sm text-muted-foreground">Sessões de assinatura iniciadas pelo site. A clínica só é criada após o pagamento confirmado.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Sessões ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Clínica / slug</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Plano</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Clínica criada?</th>
                  <th className="px-3 py-2 font-medium">Criado</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum checkout ainda.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2"><div className="font-medium text-foreground">{r.clinicName}</div><div className="text-xs text-muted-foreground">{r.desiredSlug}</div></td>
                    <td className="px-3 py-2 text-muted-foreground">{r.ownerEmail}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.planName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatCentsBRL(r.amountInCents)}</td>
                    <td className="px-3 py-2"><FounderBadge label={r.status} tone={STATUS_TONE[r.status] ?? "muted"} /></td>
                    <td className="px-3 py-2">{r.clinicCreated ? "Sim" : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
