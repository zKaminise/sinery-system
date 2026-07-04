"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { SineryWordmark } from "@/components/brand/sinery-brand"

function ResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = React.useState(searchParams.get("email") ?? "")
  const [code, setCode] = React.useState("")
  const [verified, setVerified] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [cooldown, setCooldown] = React.useState(0)

  React.useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (data.status === "ok") {
        setVerified(true)
      } else {
        setError(data.message ?? "Código inválido.")
      }
    } catch {
      setError("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }

  async function submitNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/password-reset/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, confirmPassword: confirm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Não foi possível redefinir.")
        setLoading(false)
        return
      }
      toast.success("Senha redefinida com sucesso. Faça login novamente.")
      router.push("/login")
    } catch {
      setError("Erro de conexão.")
      setLoading(false)
    }
  }

  async function resend() {
    setError(null)
    await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setCooldown(60)
    toast.success("Se este e-mail estiver cadastrado, um novo código foi enviado.")
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
      <SineryWordmark priority className="mb-6 h-8" />
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Redefinir senha</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {verified ? "Defina sua nova senha." : "Digite o código enviado ao seu e-mail. Ele expira em 10 minutos."}
      </p>
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      {!verified ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Código</Label>
            <Input id="code" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 dígitos" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Verificando..." : "Verificar código"}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={cooldown > 0} onClick={resend}>
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitNewPassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <span className="text-xs text-muted-foreground">Mínimo 8 caracteres, com letra e número.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Salvando..." : "Redefinir senha"}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">Voltar ao login</Link>
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <React.Suspense fallback={null}>
        <ResetForm />
      </React.Suspense>
    </div>
  )
}
