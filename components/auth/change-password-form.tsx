"use client"

import * as React from "react"
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { changePasswordSchema } from "@/lib/validation/auth"

export function ChangePasswordForm() {
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const validation = changePasswordSchema.safeParse({ password, confirmPassword })
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Dados inválidos.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.error ?? "Não foi possível alterar a senha.")
        setLoading(false)
        return
      }

      setSuccess(true)
      window.setTimeout(() => {
        window.location.href = "/dashboard"
      }, 900)
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.")
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Alert>
        <CheckCircle2 className="size-4 text-success" />
        <AlertDescription>
          Senha alterada com sucesso. Redirecionando para o dashboard...
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
          required
        />
        <p className="text-xs text-muted-foreground">
          Mínimo de 8 caracteres, com pelo menos 1 letra e 1 número.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={loading}
          required
        />
      </div>

      <Button type="submit" className="mt-2 w-full" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <KeyRound className="size-4" />
            Salvar nova senha
          </>
        )}
      </Button>
    </form>
  )
}
