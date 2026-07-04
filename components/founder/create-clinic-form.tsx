"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Copy, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { slugify } from "@/lib/platform/slug"

interface PlanOption {
  id: string
  name: string
}

interface SuccessData {
  clinicName: string
  slug: string
  url: string
  ownerEmail: string
  provisionalPassword: string
  subscriptionStatus: string
  nextDueDate: string | null
  planName: string | null
}

const SUBSCRIPTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "trial", label: "Trial" },
  { value: "monthly", label: "Mensal (manual)" },
  { value: "yearly", label: "Anual (manual)" },
  { value: "founder_deal", label: "Founder deal" },
  { value: "free", label: "Gratuito" },
  { value: "exempt", label: "Isento" },
  { value: "custom", label: "Custom" },
]

export function CreateClinicForm({ plans }: { plans: PlanOption[] }) {
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState<SuccessData | null>(null)
  const [slugPreview, setSlugPreview] = React.useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries())
    try {
      const res = await fetch("/api/founder/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar a clínica.")
        setLoading(false)
        return
      }
      setSuccess(data.data)
    } catch {
      setError("Erro de conexão.")
      setLoading(false)
    }
  }

  if (success) {
    const welcome = `Olá, ${success.clinicName ? "responsável" : ""}. Seu acesso ao Sinery System foi criado. Acesse ${success.url}, use o e-mail ${success.ownerEmail} e a senha provisória ${success.provisionalPassword}. No primeiro acesso, será necessário trocar a senha.`
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader className="flex-row items-center gap-2">
          <CheckCircle2 className="size-5 text-success" />
          <CardTitle>Clínica criada com sucesso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            A senha provisória é exibida <strong>uma única vez</strong>. Copie e envie ao responsável agora.
          </Alert>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Field label="Clínica" value={success.clinicName} />
            <Field label="Slug" value={success.slug} />
            <Field label="URL de acesso" value={success.url} />
            <Field label="E-mail do responsável" value={success.ownerEmail} />
            <Field label="Senha provisória" value={success.provisionalPassword} mono />
            <Field label="Plano" value={success.planName ?? "—"} />
            <Field label="Assinatura" value={success.subscriptionStatus} />
            <Field label="Próximo vencimento" value={success.nextDueDate ?? "—"} />
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(welcome)
                toast.success("Mensagem de boas-vindas copiada.")
              }}
            >
              <Copy className="size-4" />
              Copiar mensagem de boas-vindas
            </Button>
            <Button variant="outline" render={<Link href={`/founder/clientes`}>Voltar aos clientes</Link>} nativeButton={false} />
          </div>
          <p className="text-xs text-muted-foreground">
            O envio automático por e-mail (Resend) será implementado futuramente — por enquanto copie e envie manualmente.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-6">
      {error && <Alert variant="destructive">{error}</Alert>}

      <Section title="Dados da clínica">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field2 label="Nome da clínica *">
            <Input name="name" required onChange={(e) => setSlugPreview(slugify(e.target.value))} placeholder="Clínica Piloto Alpha" />
          </Field2>
          <Field2 label="Slug / subdomínio *">
            <Input name="slug" required placeholder={slugPreview || "piloto-alpha"} />
            {slugPreview && <span className="text-xs text-muted-foreground">Sugestão: {slugPreview}</span>}
          </Field2>
          <Field2 label="Segmento">
            <select name="segment" defaultValue="ODONTOLOGY" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="ODONTOLOGY">Odontologia</option>
              <option value="PHYSIOTHERAPY">Fisioterapia</option>
              <option value="AESTHETICS">Estética</option>
              <option value="PSYCHOLOGY">Psicologia</option>
              <option value="MEDICAL">Médica</option>
              <option value="OTHER">Outro</option>
            </select>
          </Field2>
          <Field2 label="E-mail principal">
            <Input name="email" type="email" placeholder="contato@clinica.com.br" />
          </Field2>
          <Field2 label="Telefone / WhatsApp">
            <Input name="whatsapp" placeholder="(11) 99999-0000" />
          </Field2>
          <div className="grid grid-cols-2 gap-2">
            <Field2 label="Cidade"><Input name="city" /></Field2>
            <Field2 label="UF"><Input name="state" maxLength={2} /></Field2>
          </div>
        </div>
      </Section>

      <Section title="Responsável (OWNER inicial)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field2 label="Nome do responsável *"><Input name="ownerName" required /></Field2>
          <Field2 label="E-mail do responsável *"><Input name="ownerEmail" type="email" required placeholder="owner@clinica.com.br" /></Field2>
          <Field2 label="Senha provisória (opcional)">
            <Input name="ownerPassword" placeholder="Deixe vazio para gerar automaticamente" />
            <span className="text-xs text-muted-foreground">Se vazio, uma senha forte é gerada e exibida uma vez.</span>
          </Field2>
        </div>
      </Section>

      <Section title="Comercial">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field2 label="Tipo">
            <select name="subscriptionType" defaultValue="trial" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {SUBSCRIPTION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field2>
          <Field2 label="Plano">
            <select name="planId" defaultValue="" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Sem plano</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field2>
          <Field2 label="Valor (R$)"><Input name="amountInReais" type="number" step="0.01" min="0" defaultValue="0" /></Field2>
          <Field2 label="Início"><Input name="startDate" type="date" /></Field2>
          <Field2 label="Próximo vencimento"><Input name="nextDueDate" type="date" /></Field2>
          <div className="grid grid-cols-2 gap-2">
            <Field2 label="Dias de trial"><Input name="trialDays" type="number" min="0" defaultValue="14" /></Field2>
            <Field2 label="Tolerância (dias)"><Input name="graceDays" type="number" min="0" defaultValue="20" /></Field2>
          </div>
          <Field2 label="Observações internas">
            <Input name="internalNotes" placeholder="Ex.: founder deal, contato via indicação..." />
          </Field2>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" render={<Link href="/founder/clientes">Cancelar</Link>} nativeButton={false} />
        <Button type="submit" disabled={loading}>{loading ? "Criando..." : "Criar clínica"}</Button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm text-foreground" : "text-sm text-foreground"}>{value}</dd>
    </div>
  )
}
