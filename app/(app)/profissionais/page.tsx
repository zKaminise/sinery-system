import { Stethoscope } from "lucide-react"

import { PagePlaceholder } from "@/components/layout/page-placeholder"

export default function ProfissionaisPage() {
  return (
    <PagePlaceholder
      title="Profissionais"
      description="Equipe, especialidades e agenda de cada profissional"
      icon={Stethoscope}
    />
  )
}
