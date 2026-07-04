"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"

export function FounderChangePasswordForm() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/founder/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: fd.get("password"), confirmPassword: fd.get("confirmPassword") }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Não foi possível trocar a senha.")
        setLoading(false)
        return
      }
      window.location.href = "/founder"
    } catch {
      setError("Erro de conexão.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        <span className="text-xs text-muted-foreground">Mínimo 8 caracteres, com letra e número.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" disabled={loading} className="mt-2 w-full">{loading ? "Salvando..." : "Definir senha"}</Button>
    </form>
  )
}
