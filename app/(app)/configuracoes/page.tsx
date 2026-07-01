import { Settings } from "lucide-react"

import { PagePlaceholder } from "@/components/layout/page-placeholder"

export default function ConfiguracoesPage() {
  return (
    <PagePlaceholder
      title="Configurações"
      description="Preferências da clínica e do sistema"
      icon={Settings}
    />
  )
}
