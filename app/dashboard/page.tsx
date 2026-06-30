import { CalendarCheck2, Hourglass, MessagesSquare, Bot } from "lucide-react"

import { StatCard } from "@/components/dashboard/stat-card"
import { AgendaCard } from "@/components/dashboard/agenda-card"
import { ConversationsCard } from "@/components/dashboard/conversations-card"
import { AssistCard } from "@/components/dashboard/assist-card"
import { dashboardStats } from "@/lib/mock-data"

const statIcons = [CalendarCheck2, Hourglass, MessagesSquare, Bot] as const
const statAccents = ["primary", "warning", "secondary", "success"] as const

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Bem-vinda de volta!
        </h2>
        <p className="text-sm text-muted-foreground">
          Aqui está um resumo do que está acontecendo na Clínica Sorria Odonto hoje.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            icon={statIcons[index]}
            accent={statAccents[index]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AgendaCard />
        <ConversationsCard />
      </div>

      <AssistCard />
    </div>
  )
}
