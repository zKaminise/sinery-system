import { ClipboardList } from "lucide-react"

import { PagePlaceholder } from "@/components/layout/page-placeholder"

export default function ServicosPage() {
  return (
    <PagePlaceholder
      title="Serviços"
      description="Procedimentos, preços e duração dos atendimentos"
      icon={ClipboardList}
    />
  )
}
