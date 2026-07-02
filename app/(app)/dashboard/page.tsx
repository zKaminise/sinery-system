import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/current-user"
import { getCurrentClinicSafe } from "@/lib/tenant"
import { getDashboardData } from "@/lib/dashboard/queries"
import { getClinicTimeZone, utcToClinicParts } from "@/lib/appointments/date-utils"
import {
  canCreatePatient,
  canCreateProfessional,
  canCreateService,
  canManageAppointments,
} from "@/lib/permissions"
import { logger } from "@/lib/logger"
import { ErrorState } from "@/components/common/error-state"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSummaryCards } from "@/components/dashboard/dashboard-summary-cards"
import { TodayAppointments } from "@/components/dashboard/today-appointments"
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments"
import { WeeklySummary } from "@/components/dashboard/weekly-summary"
import { OperationalAlerts } from "@/components/dashboard/operational-alerts"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { AssistPreviewCard } from "@/components/dashboard/assist-preview-card"
import type { DashboardData } from "@/lib/dashboard/queries"

export const metadata: Metadata = {
  title: "Dashboard — Sinery System",
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/api/auth/clear-session")
  }

  const { clinic, dbError } = await getCurrentClinicSafe()

  let data: DashboardData | null = null
  let loadFailed = dbError

  if (clinic && !dbError) {
    try {
      data = await getDashboardData(user.clinicId)
    } catch (error) {
      loadFailed = true
      logger.error("Falha ao carregar o dashboard", {
        context: "dashboard",
        error,
        metadata: { clinicId: user.clinicId },
      })
    }
  }

  const timeZone = getClinicTimeZone(data?.timeZone)
  const hour = Number(utcToClinicParts(new Date(), timeZone).time.split(":")[0])

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader userName={user.name} hour={hour} clinic={clinic} dbError={dbError} />

      {!clinic ? (
        <ErrorState
          title={dbError ? "Não foi possível conectar ao banco de dados" : "Nenhuma clínica encontrada"}
          description={
            dbError
              ? "Verifique se o PostgreSQL está rodando e se DATABASE_URL está configurado em .env."
              : "Este usuário não está associado a nenhuma clínica ativa."
          }
        />
      ) : loadFailed || !data ? (
        <ErrorState description="Não foi possível carregar os indicadores da clínica. Tente novamente em instantes." />
      ) : (
        <>
          <DashboardSummaryCards summary={data.summary} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TodayAppointments appointments={data.todayAppointments} />
            <UpcomingAppointments appointments={data.upcomingAppointments} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <OperationalAlerts alerts={data.alerts} />
            <WeeklySummary week={data.week} />
          </div>

          <AssistPreviewCard assist={data.assist} />

          <QuickActions
            canCreatePatient={canCreatePatient(user.role)}
            canCreateProfessional={canCreateProfessional(user.role)}
            canCreateService={canCreateService(user.role)}
            canManageAppointments={canManageAppointments(user.role)}
          />
        </>
      )}
    </div>
  )
}
