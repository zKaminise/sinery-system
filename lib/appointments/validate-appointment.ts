import "server-only"

import { prisma } from "@/lib/prisma"
import { getClinicTimeZone, getDayOfWeekForDate, zonedWallClockToUtc } from "@/lib/appointments/date-utils"
import {
  isWithinWorkingHours,
  findConflictingAppointment,
  BLOCKING_STATUSES,
} from "@/lib/appointments/availability"

interface ValidateInput {
  clinicId: string
  patientId: string
  professionalId: string
  serviceId?: string
  date: string
  startTime: string
  endTime: string
  /** Skip this appointment id in conflict detection (edit flow). */
  excludeAppointmentId?: string
}

export type ValidateResult =
  | {
      ok: true
      startAt: Date
      endAt: Date
      serviceId: string | null
      title: string | null
      timeZone: string
    }
  | { ok: false; status: number; message: string }

/**
 * Full server-side validation for creating/editing an appointment. Every
 * referenced entity is re-checked against the current clinicId (never trusting
 * the client), plus active/archived state, professional↔service link,
 * working-hours fit, and time conflicts. Returns the resolved UTC instants on
 * success or a typed {status,message} error otherwise.
 */
export async function validateAndResolveAppointment(input: ValidateInput): Promise<ValidateResult> {
  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: input.clinicId },
    select: { timezone: true },
  })
  const timeZone = getClinicTimeZone(settings?.timezone)

  // Patient — must belong to the clinic and not be archived.
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId: input.clinicId },
    select: { id: true, status: true, name: true },
  })
  if (!patient) {
    return { ok: false, status: 404, message: "Paciente não encontrado ou não pertence à clínica atual." }
  }
  if (patient.status === "ARCHIVED") {
    return { ok: false, status: 422, message: "Não é possível agendar para um paciente arquivado." }
  }

  // Professional — must belong to the clinic and be active.
  const professional = await prisma.professional.findFirst({
    where: { id: input.professionalId, clinicId: input.clinicId },
    select: { id: true, status: true, name: true },
  })
  if (!professional) {
    return { ok: false, status: 404, message: "Profissional não encontrado ou não pertence à clínica atual." }
  }
  if (professional.status !== "ACTIVE") {
    return { ok: false, status: 422, message: "Este profissional está inativo." }
  }

  // Service (optional) — must belong to the clinic, be active, and be linked
  // to the chosen professional.
  let serviceTitle: string | null = null
  if (input.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, clinicId: input.clinicId },
      select: { id: true, status: true, name: true },
    })
    if (!service) {
      return { ok: false, status: 404, message: "Serviço não encontrado ou não pertence à clínica atual." }
    }
    if (service.status !== "ACTIVE") {
      return { ok: false, status: 422, message: "O serviço selecionado está inativo." }
    }
    const link = await prisma.professionalService.findUnique({
      where: {
        professionalId_serviceId: { professionalId: professional.id, serviceId: service.id },
      },
      select: { id: true },
    })
    if (!link) {
      return { ok: false, status: 422, message: "Este profissional não realiza o serviço selecionado." }
    }
    serviceTitle = service.name
  }

  // Working hours — the interval must fit inside an active block that day.
  const dayOfWeek = getDayOfWeekForDate(input.date, timeZone)
  const workingHours = await prisma.workingHour.findMany({
    where: { clinicId: input.clinicId, professionalId: professional.id, active: true },
    select: { dayOfWeek: true, startTime: true, endTime: true, active: true },
  })
  if (!isWithinWorkingHours(dayOfWeek, input.startTime, input.endTime, workingHours)) {
    return { ok: false, status: 422, message: "Este profissional não atende neste horário." }
  }

  // Convert clinic-local wall clock to UTC instants for storage + conflict.
  const startAt = zonedWallClockToUtc(input.date, input.startTime, timeZone)
  const endAt = zonedWallClockToUtc(input.date, input.endTime, timeZone)

  // Conflict — any blocking appointment for this professional overlapping the
  // interval (excluding the appointment being edited).
  const overlapping = await prisma.appointment.findMany({
    where: {
      clinicId: input.clinicId,
      professionalId: professional.id,
      status: { in: BLOCKING_STATUSES },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, startAt: true, endAt: true, status: true },
  })
  const conflict = findConflictingAppointment(startAt, endAt, overlapping, input.excludeAppointmentId)
  if (conflict) {
    return { ok: false, status: 409, message: "Já existe uma consulta para este profissional nesse horário." }
  }

  return {
    ok: true,
    startAt,
    endAt,
    serviceId: input.serviceId ?? null,
    title: serviceTitle,
    timeZone,
  }
}
