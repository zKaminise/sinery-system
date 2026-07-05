import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

/** Safe, presentational messaging-provider summary (no secrets). Prompt 24. */
export interface MessagingProviderCardProps {
  appEnv: "local" | "staging" | "production"
  clinicProviderLabel: string
  isEvolution: boolean
  evolution: {
    enabled: boolean
    allowedHere: boolean
    configured: boolean
    webhookEnabled: boolean
    sendMessagesEnabled: boolean
    sendMockMode: boolean
    autoProcessAssist: boolean
    assistReplyEnabled: boolean
    instanceName: string | null
    hasApiKey: boolean
    hasWebhookSecret: boolean
    lastReceivedAt: string | null
    lastSentAt: string | null
  }
}

function YesNo({ value }: { value: boolean }) {
  return <Badge variant={value ? "default" : "secondary"}>{value ? "Sim" : "Não"}</Badge>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  )
}

export function MessagingProviderCard({ appEnv, clinicProviderLabel, isEvolution, evolution }: MessagingProviderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Mensageria
          <Badge variant={isEvolution ? "secondary" : "default"}>{clinicProviderLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <Row label="Ambiente (APP_ENV)">{appEnv}</Row>
        <Row label="Provider da clínica">{clinicProviderLabel}</Row>

        {isEvolution && (
          <>
            <Row label="Evolution habilitada">
              <YesNo value={evolution.enabled} />
            </Row>
            <Row label="Permitida neste ambiente">
              <YesNo value={evolution.allowedHere} />
            </Row>
            <Row label="Instance name">{evolution.instanceName ?? "—"}</Row>
            <Row label="Configurada (URL+key+instance)">
              <YesNo value={evolution.configured} />
            </Row>
            <Row label="Modo mock (envio)">
              <YesNo value={evolution.sendMockMode} />
            </Row>
            <Row label="Webhook habilitado">
              <YesNo value={evolution.webhookEnabled} />
            </Row>
            <Row label="Envio habilitado">
              <YesNo value={evolution.sendMessagesEnabled} />
            </Row>
            <Row label="Auto Assist">
              <YesNo value={evolution.autoProcessAssist} />
            </Row>
            <Row label="Resposta da Assist habilitada">
              <YesNo value={evolution.assistReplyEnabled} />
            </Row>
            <Row label="Segredo do webhook configurado">
              <YesNo value={evolution.hasWebhookSecret} />
            </Row>
            <Row label="Último recebimento">{evolution.lastReceivedAt ?? "—"}</Row>
            <Row label="Último envio">{evolution.lastSentAt ?? "—"}</Row>

            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              A Evolution API é usada apenas para HML/testes. Produção deve usar a API oficial da Meta (Meta Cloud API).
              A API key e o segredo do webhook são server-only e nunca aparecem aqui.
            </p>
          </>
        )}

        {!isEvolution && (
          <p className="mt-2 text-xs text-muted-foreground">
            Esta clínica usa a Meta Cloud API (API oficial da Meta) — recomendada para produção. A Evolution API fica
            disponível apenas para HML/testes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
