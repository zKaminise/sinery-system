import { MessagesSquare } from "lucide-react"

import { PagePlaceholder } from "@/components/layout/page-placeholder"

export default function ConversasPage() {
  return (
    <PagePlaceholder
      title="Conversas"
      description="Central de mensagens com pacientes"
      icon={MessagesSquare}
    />
  )
}
