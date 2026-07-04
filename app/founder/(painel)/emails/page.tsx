import { listEmailLogs } from "@/lib/platform/founder-queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FounderBadge } from "@/components/founder/founder-badge"
import type { BadgeTone } from "@/lib/platform/founder-labels"

export const metadata = { title: "E-mails — Sinery Founder" }

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "muted",
  MOCKED: "info",
  SENT: "success",
  FAILED: "danger",
}

export default async function FounderEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const sp = await searchParams
  const rows = await listEmailLogs({ status: sp.status, type: sp.type })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">E-mails</h2>
        <p className="text-sm text-muted-foreground">Registro de e-mails transacionais (Resend). O conteúdo sensível (códigos/senhas) nunca é armazenado.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos</option>
            {["PENDING", "MOCKED", "SENT", "FAILED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <select name="type" defaultValue={sp.type ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos</option>
            {["PASSWORD_RESET_CODE", "OWNER_WELCOME_FOUNDER", "OWNER_WELCOME_CHECKOUT", "TEMPORARY_PASSWORD_RESET", "BILLING_PAYMENT_CONFIRMED"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">Filtrar</button>
      </form>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos envios ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Para</th>
                  <th className="px-3 py-2 font-medium">Assunto</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Quando</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum e-mail registrado.</td></tr>}
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{e.toEmail}</td>
                    <td className="px-3 py-2 text-foreground">{e.subject}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.type}</td>
                    <td className="px-3 py-2"><FounderBadge label={e.status} tone={STATUS_TONE[e.status] ?? "muted"} /></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.createdAt}</td>
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
