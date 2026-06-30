import { Users } from "lucide-react"

import { PagePlaceholder } from "@/components/layout/page-placeholder"

export default function PacientesPage() {
  return (
    <PagePlaceholder
      title="Pacientes"
      description="Cadastro, histórico e prontuário dos pacientes"
      icon={Users}
    />
  )
}
