"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookOpen, Plus, Pencil, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/empty-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { KnowledgeItem } from "@/lib/assist/queries"

interface KnowledgeBaseManagerProps {
  items: KnowledgeItem[]
  canManage: boolean
}

export function KnowledgeBaseManager({ items, canManage }: KnowledgeBaseManagerProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<KnowledgeItem | null>(null)
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setTitle("")
    setContent("")
    setDialogOpen(true)
  }

  function openEdit(item: KnowledgeItem) {
    setEditing(item)
    setTitle(item.title)
    setContent(item.content)
    setDialogOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const url = editing ? `/api/assist/knowledge/${editing.id}` : "/api/assist/knowledge"
      const method = editing ? "PATCH" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar o item.")
        return
      }
      toast.success(editing ? "Item atualizado." : "Item criado.")
      setDialogOpen(false)
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: KnowledgeItem) {
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/assist/knowledge/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o item.")
        return
      }
      toast.success(item.active ? "Item inativado." : "Item ativado.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4.5 text-primary" />
          <CardTitle>Base de conhecimento</CardTitle>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="size-4" /> Novo item
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhum item cadastrado."
            description="Cadastre informações úteis para orientar o atendimento."
          />
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent",
                      item.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => openEdit(item)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => toggleActive(item)}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : item.active ? (
                      "Inativar"
                    ) : (
                      "Ativar"
                    )}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      {canManage && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle>
              <DialogDescription>
                Informação de apoio ao atendimento (endereço, formas de pagamento, políticas etc.).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kb-title">Título</Label>
                <Input id="kb-title" value={title} disabled={saving} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kb-content">Conteúdo</Label>
                <Textarea id="kb-content" value={content} disabled={saving} rows={4} maxLength={4000} onChange={(e) => setContent(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
