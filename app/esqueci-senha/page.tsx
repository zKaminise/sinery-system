"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { SineryWordmark } from "@/components/brand/sinery-brand"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setMessage(data.message ?? "Se este e-mail estiver cadastrado, enviaremos um código de recuperação.")
      // Advance to the code step after a short beat.
      setTimeout(() => router.push(`/redefinir-senha?email=${encodeURIComponent(email)}`), 1200)
    } catch {
      setMessage("Se este e-mail estiver cadastrado, enviaremos um código de recuperação.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <SineryWordmark priority className="mb-6 h-8" />
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Esqueci minha senha</h1>
        <p className="mb-6 text-sm text-muted-foreground">Informe seu e-mail cadastrado para receber um código de recuperação.</p>
        {message && <Alert className="mb-4">{message}</Alert>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Enviando..." : "Enviar código"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </div>
  )
}
