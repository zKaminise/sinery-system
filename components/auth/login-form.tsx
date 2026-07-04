"use client"

import * as React from "react"
import { Loader2, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function LoginForm() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showReset, setShowReset] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.error ?? "E-mail ou senha inválidos.")
        setLoading(false)
        return
      }

      // Full navigation so the proxy and the authenticated layout re-evaluate
      // the freshly-set session cookie from scratch.
      window.location.href = "/dashboard"
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@suaclinica.com.br"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <button
            type="button"
            onClick={() => setShowReset((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
          required
        />
      </div>

      {showReset && (
        <Alert>
          <AlertDescription>
            A redefinição é feita pela sua clínica. Peça ao administrador (OWNER/ADMIN) para gerar uma nova senha
            provisória em Configurações → Usuários — você definirá uma nova senha ao entrar.
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="mt-2 w-full" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            Entrar
          </>
        )}
      </Button>
    </form>
  )
}
