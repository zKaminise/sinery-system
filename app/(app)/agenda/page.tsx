import { CalendarDays } from "lucide-react"

import { PagePlaceholder } from "@/components/layout/page-placeholder"

export default function AgendaPage() {
  return (
    <PagePlaceholder
      title="Agenda"
      description="Gerencie consultas, horários e disponibilidade da clínica"
      icon={CalendarDays}
    />
  )
}
