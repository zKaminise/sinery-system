"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { clinicSegments } from "@/lib/validators/settings"
import type { SettingsClinic } from "@/components/settings/types"
import type { ClinicStatus } from "@/lib/generated/prisma/client"

const segmentLabels: Record<string, string> = {
  ODONTOLOGY: "Odontologia",
  PHYSIOTHERAPY: "Fisioterapia",
  AESTHETICS: "Estética",
  PSYCHOLOGY: "Psicologia",
  MEDICAL: "Clínica médica",
  OTHER: "Outro",
}

const statusLabels: Record<ClinicStatus, string> = {
  ACTIVE: "Ativa",
  SETUP_PENDING: "Configuração pendente",
  INACTIVE: "Inativa",
  SUSPENDED: "Suspensa",
}

const statusStyles: Record<ClinicStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  SETUP_PENDING: "bg-warning/10 text-warning",
  INACTIVE: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-destructive/10 text-destructive",
}

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30"

export function ClinicSettingsForm({
  clinic,
  canManage,
}: {
  clinic: SettingsClinic
  canManage: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    name: clinic.name,
    legalName: clinic.legalName ?? "",
    document: clinic.document ?? "",
    segment: clinic.segment as string,
    email: clinic.email ?? "",
    phone: clinic.phone ?? "",
    whatsapp: clinic.whatsapp ?? "",
    address: clinic.address ?? "",
    city: clinic.city ?? "",
    state: clinic.state ?? "",
    logoUrl: clinic.logoUrl ?? "",
  })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    setLoading(true)
    try {
      const response = await fetch("/api/settings/clinic", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar.")
        return
      }
      toast.success("Dados da clínica atualizados.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const disabled = !canManage || loading

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Dados da clínica</CardTitle>
          <CardDescription>
            Informações de identificação e contato da sua clínica.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome da clínica" htmlFor="name" className="md:col-span-2">
            <Input id="name" value={form.name} disabled={disabled} required
              onChange={(e) => set("name", e.target.value)} />
          </Field>

          <Field label="Razão social" htmlFor="legalName">
            <Input id="legalName" value={form.legalName} disabled={disabled}
              onChange={(e) => set("legalName", e.target.value)} />
          </Field>

          <Field label="CPF/CNPJ" htmlFor="document">
            <Input id="document" value={form.document} disabled={disabled}
              onChange={(e) => set("document", e.target.value)} />
          </Field>

          <Field label="Segmento" htmlFor="segment">
            <select id="segment" className={selectClass} value={form.segment} disabled={disabled}
              onChange={(e) => set("segment", e.target.value)}>
              {clinicSegments.map((s) => (
                <option key={s} value={s}>{segmentLabels[s]}</option>
              ))}
            </select>
          </Field>

          <Field label="Status da clínica" htmlFor="status">
            <div className="flex h-9 items-center">
              <Badge variant="outline" className={cn("border-transparent", statusStyles[clinic.status])}>
                {statusLabels[clinic.status]}
              </Badge>
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" /> somente leitura
              </span>
            </div>
          </Field>

          <Field label="E-mail principal" htmlFor="email">
            <Input id="email" type="email" value={form.email} disabled={disabled}
              onChange={(e) => set("email", e.target.value)} />
          </Field>

          <Field label="Telefone" htmlFor="phone">
            <Input id="phone" value={form.phone} disabled={disabled}
              onChange={(e) => set("phone", e.target.value)} />
          </Field>

          <Field label="WhatsApp" htmlFor="whatsapp">
            <Input id="whatsapp" value={form.whatsapp} disabled={disabled}
              placeholder="5511999990000" onChange={(e) => set("whatsapp", e.target.value)} />
          </Field>

          <Field label="Endereço" htmlFor="address" className="md:col-span-2">
            <Input id="address" value={form.address} disabled={disabled}
              onChange={(e) => set("address", e.target.value)} />
          </Field>

          <Field label="Cidade" htmlFor="city">
            <Input id="city" value={form.city} disabled={disabled}
              onChange={(e) => set("city", e.target.value)} />
          </Field>

          <Field label="Estado (UF)" htmlFor="state">
            <Input id="state" value={form.state} disabled={disabled} maxLength={40}
              onChange={(e) => set("state", e.target.value)} />
          </Field>

          <Field label="Logo (URL)" htmlFor="logoUrl" className="md:col-span-2">
            <Input id="logoUrl" value={form.logoUrl} disabled={disabled}
              placeholder="https://..." onChange={(e) => set("logoUrl", e.target.value)} />
          </Field>
        </CardContent>
        {canManage ? (
          <CardFooter className="justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Salvar alterações
            </Button>
          </CardFooter>
        ) : (
          <CardFooter className="text-sm text-muted-foreground">
            <Lock className="size-4" />
            Você tem acesso somente leitura a esta seção.
          </CardFooter>
        )}
      </Card>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
