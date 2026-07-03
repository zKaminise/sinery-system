"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  MessageCircle,
  KeyRound,
  Webhook,
  Send,
  ShieldCheck,
  CircleCheck,
  CircleX,
  Loader2,
  ArrowLeft,
  Info,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WhatsAppIntegrationView } from "@/lib/whatsapp/whatsapp-queries"

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-secondary/40 disabled:opacity-60"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  NOT_CONFIGURED: { label: "Não configurado", className: "bg-warning/10 text-warning" },
  CONFIGURED: { label: "Configurado", className: "bg-primary/10 text-primary" },
  INVALID_CONFIG: { label: "Configuração inválida", className: "bg-destructive/10 text-destructive" },
  DISABLED: { label: "Desativado", className: "bg-muted text-muted-foreground" },
  READY_FOR_WEBHOOK: { label: "Pronto p/ webhook", className: "bg-success/10 text-success" },
  READY_FOR_SEND: { label: "Pronto p/ envio", className: "bg-success/10 text-success" },
  ERROR: { label: "Erro", className: "bg-destructive/10 text-destructive" },
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
      <CircleCheck className="size-3.5" /> Configurado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <CircleX className="size-3.5" /> Não configurado
    </span>
  )
}

function EnabledNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
      <CircleCheck className="size-3.5" /> Habilitado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <CircleX className="size-3.5" /> Desativado
    </span>
  )
}

export function WhatsAppIntegrationPanel({
  integration,
  canManage,
}: {
  integration: WhatsAppIntegrationView
  canManage: boolean
}) {
  const router = useRouter()
  const [enabled, setEnabled] = React.useState(integration.enabled)
  const [displayPhoneNumber, setDisplayPhoneNumber] = React.useState(integration.displayPhoneNumber ?? "")
  const [verifiedName, setVerifiedName] = React.useState(integration.verifiedName ?? "")
  const [saving, setSaving] = React.useState(false)
  const [checking, setChecking] = React.useState(false)

  const badge = STATUS_BADGE[integration.status] ?? STATUS_BADGE.NOT_CONFIGURED
  const env = integration.env
  const webhookBase = process.env.NEXT_PUBLIC_APP_URL || "https://seu-dominio-publico"
  const webhookUrl = `${webhookBase}${integration.webhook.path}`

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/whatsapp/integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, displayPhoneNumber, verifiedName }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar.")
        return
      }
      toast.success("Configuração local salva.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  async function verify() {
    setChecking(true)
    try {
      const res = await fetch("/api/whatsapp/integration/check", { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Não foi possível verificar.")
        return
      }
      toast.success("Configuração verificada (nenhuma mensagem enviada).")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setChecking(false)
    }
  }

  const envChecklist: { label: string; value: boolean }[] = [
    { label: "WHATSAPP_CLOUD_API_ENABLED", value: env.enabled },
    { label: "WHATSAPP_ACCESS_TOKEN", value: env.hasAccessToken },
    { label: "WHATSAPP_PHONE_NUMBER_ID", value: env.hasPhoneNumberId },
    { label: "WHATSAPP_BUSINESS_ACCOUNT_ID", value: env.hasBusinessAccountId },
    { label: "WHATSAPP_APP_ID", value: env.hasAppId },
    { label: "WHATSAPP_APP_SECRET", value: env.hasAppSecret },
    { label: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", value: env.hasWebhookVerifyToken },
    { label: "WHATSAPP_SEND_MESSAGES_ENABLED", value: env.sendMessagesEnabled },
    { label: "WHATSAPP_WEBHOOK_ENABLED", value: env.webhookEnabled },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-success/10 text-success">
            <MessageCircle className="size-5.5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">WhatsApp Cloud API</h2>
            <p className="text-sm text-muted-foreground">
              Prepare a integração oficial com WhatsApp para receber e responder pacientes pela Sinery Assist.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/configuracoes"><ArrowLeft className="size-4" /> Voltar</Link>} />
          {canManage && (
            <Button onClick={verify} disabled={checking}>
              {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Verificar configuração
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>
          A integração com WhatsApp está sendo preparada. Neste momento, o sistema ainda não recebe nem envia mensagens
          reais. O webhook real e o envio serão implementados nas próximas etapas.
        </span>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="text-xs text-muted-foreground">Status da integração</span>
            <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Phone Number ID</span>
            <span className="text-sm font-semibold text-foreground">{integration.phoneNumberIdMasked}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Business Account ID</span>
            <span className="text-sm font-semibold text-foreground">{integration.businessAccountIdMasked}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Última validação</span>
            <span className="text-sm font-semibold text-foreground">
              {integration.lastConfigCheckAt
                ? new Date(integration.lastConfigCheckAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                : "Nunca"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Section 1 — local clinic config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração local da clínica</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-primary)]"
              checked={enabled}
              disabled={!canManage || saving}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="text-foreground">Integração habilitada para esta clínica</span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Número exibido (display phone)
              <input
                className={inputClass}
                value={displayPhoneNumber}
                disabled={!canManage || saving}
                placeholder="+55 34 99999-0000"
                onChange={(e) => setDisplayPhoneNumber(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Nome verificado
              <input
                className={inputClass}
                value={verifiedName}
                disabled={!canManage || saving}
                placeholder="Clínica Sorria Odonto"
                onChange={(e) => setVerifiedName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Provedor
              <input className={inputClass} value={integration.provider} disabled readOnly />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Webhook path (via ambiente)
              <input className={inputClass} value={integration.webhookPath ?? "—"} disabled readOnly />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Webhook className="size-3.5" /> Recebimento (env): <EnabledNo value={integration.webhookEnabled} />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Send className="size-3.5" /> Envio (env): <EnabledNo value={integration.sendMessagesEnabled} />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Verify token: <YesNo value={integration.webhookVerifyTokenConfigured} />
            </span>
          </div>

          {canManage && (
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Salvar configuração local
              </Button>
            </div>
          )}
          {!canManage && (
            <p className="text-xs text-muted-foreground">Você tem acesso somente leitura à integração WhatsApp.</p>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — environment checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4.5 text-primary" /> Configuração segura do ambiente
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            As credenciais sensíveis são lidas apenas no servidor por variáveis de ambiente e não são exibidas na
            interface.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {envChecklist.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <code className="text-xs text-foreground">{c.label}</code>
                <YesNo value={c.value} />
              </li>
            ))}
          </ul>
          {integration.issues.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <p className="font-medium">Pendências:</p>
              <ul className="list-inside list-disc">
                {integration.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook (Prompt 17) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="size-4.5 text-primary" /> Webhook de recebimento
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            URL do webhook (configure na Meta)
            <input className={inputClass} value={webhookUrl} disabled readOnly />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">Recebimento</span>
              <EnabledNo value={integration.webhook.enabled} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">Verify token</span>
              <YesNo value={integration.webhook.hasVerifyToken} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">Validação de assinatura</span>
              {integration.webhook.verifySignature ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <CircleCheck className="size-3.5" /> Ativa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                  <Info className="size-3.5" /> Desativada (apenas dev)
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">Eventos recebidos</span>
              <span className="font-medium text-foreground">{integration.webhook.recentEventsCount}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">Última verificação (GET)</span>
              <span className="font-medium text-foreground">
                {integration.webhook.lastWebhookVerifiedAt
                  ? new Date(integration.webhook.lastWebhookVerifiedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                  : "Nunca"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">Última mensagem recebida</span>
              <span className="font-medium text-foreground">
                {integration.webhook.lastMessageReceivedAt
                  ? new Date(integration.webhook.lastMessageReceivedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                  : "Nunca"}
              </span>
            </div>
          </div>
          {!integration.webhook.verifySignature && (
            <p className="rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning">
              Validação de assinatura desativada. Use apenas em desenvolvimento.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Para validar na Meta, o sistema precisa estar acessível publicamente via HTTPS. Localhost não funciona sem um
            túnel como ngrok ou um ambiente de staging.
          </p>
        </CardContent>
      </Card>

      {/* Section 3 — next steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>• <span className="font-medium text-foreground">Prompt 17:</span> ativar o webhook de recebimento (o recebimento real de mensagens será implementado no próximo prompt).</p>
          <p>• <span className="font-medium text-foreground">Prompt 18:</span> ativar o envio real (após a validação do webhook).</p>
          <p>• <span className="font-medium text-foreground">Prompt 19:</span> conectar WhatsApp + Sinery Assist + atendimento humano.</p>
        </CardContent>
      </Card>
    </div>
  )
}
