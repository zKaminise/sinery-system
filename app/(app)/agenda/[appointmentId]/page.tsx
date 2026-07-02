import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/current-user"
import { canManageAppointments } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { AppointmentDetails } from "@/components/appointments/appointment-details"
import type { AgendaFormOptions } from "@/components/appointments/types"
import {
  getClinicTimeZone,
  utcToClinicParts,
  formatClinicDateShort,
} from "@/lib/appointments/date-utils"

export const metadata: Metadata = {
  title: "Detalhes da consulta — Sinery System",
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/api/auth/clear-session")
  }

  const { appointmentId } = await params

  // Tenant guard: an appointment from another clinic simply doesn't exist
  // from this user's point of view.
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId: user.clinicId },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      createdBySource: true,
      createdAt: true,
      updatedAt: true,
      notes: true,
      patient: { select: { id: true, name: true, phone: true } },
      professional: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  })

  if (!appointment) {
    notFound()
  }

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: user.clinicId },
    select: { timezone: true, appointmentSlotMinutes: true },
  })
  const timeZone = getClinicTimeZone(settings?.timezone)
  const defaultSlotMinutes = settings?.appointmentSlotMinutes ?? 30

  const startParts = utcToClinicParts(appointment.startAt, timeZone)
  const endParts = utcToClinicParts(appointment.endAt, timeZone)
  const durationMinutes = Math.round(
    (appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000
  )

  // Form options for the edit dialog (active professionals + their services).
  const [activeProfs, patients] = await Promise.all([
    prisma.professional.findMany({
      where: { clinicId: user.clinicId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        services: {
          where: { service: { status: "ACTIVE" } },
          select: { service: { select: { id: true, name: true, durationMinutes: true } } },
        },
      },
    }),
    prisma.patient.findMany({
      where: { clinicId: user.clinicId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const servicesByProfessional: AgendaFormOptions["servicesByProfessional"] = {}
  for (const p of activeProfs) {
    servicesByProfessional[p.id] = p.services.map((link) => ({
      id: link.service.id,
      name: link.service.name,
      durationMinutes: link.service.durationMinutes,
    }))
  }

  const formOptions: AgendaFormOptions = {
    patients,
    professionals: activeProfs.map((p) => ({ id: p.id, name: p.name })),
    servicesByProfessional,
    defaultSlotMinutes,
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/agenda"><ArrowLeft className="size-4" /> Voltar para a agenda</Link>}
      />

      <AppointmentDetails
        appointment={{
          id: appointment.id,
          date: startParts.date,
          startTime: startParts.time,
          endTime: endParts.time,
          durationMinutes,
          status: appointment.status,
          createdBySource: appointment.createdBySource,
          createdByName: appointment.createdBy?.name ?? null,
          createdAt: formatClinicDateShort(appointment.createdAt, timeZone),
          updatedAt: formatClinicDateShort(appointment.updatedAt, timeZone),
          notes: appointment.notes,
          patientId: appointment.patient.id,
          patientName: appointment.patient.name,
          patientPhone: appointment.patient.phone,
          professionalId: appointment.professional.id,
          professionalName: appointment.professional.name,
          serviceId: appointment.service?.id ?? null,
          serviceName: appointment.service?.name ?? null,
        }}
        formOptions={formOptions}
        canManage={canManageAppointments(user.role)}
      />
    </div>
  )
}
