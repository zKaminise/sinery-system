import type { AppointmentStatus, CreatedBySource } from "@/lib/generated/prisma/client"

/** A row/card as shown in the agenda views (already timezone-formatted). */
export interface AppointmentItem {
  id: string
  /** Clinic-local "YYYY-MM-DD" */
  date: string
  /** Clinic-local "HH:mm" */
  startTime: string
  /** Clinic-local "HH:mm" */
  endTime: string
  status: AppointmentStatus
  createdBySource: CreatedBySource
  patientId: string
  patientName: string
  professionalId: string
  professionalName: string
  serviceId: string | null
  serviceName: string | null
  notes: string | null
}

/** Options passed to the create/edit form. */
export interface AgendaFormOptions {
  patients: { id: string; name: string }[]
  professionals: { id: string; name: string }[]
  /** professionalId -> active linked services */
  servicesByProfessional: Record<
    string,
    { id: string; name: string; durationMinutes: number }[]
  >
  /** Default slot minutes from ClinicSettings, used when no service is chosen. */
  defaultSlotMinutes: number
}

/** Values used to prefill the form when editing. */
export interface AppointmentEditValues {
  id: string
  patientId: string
  professionalId: string
  serviceId: string | null
  date: string
  startTime: string
  endTime: string
  notes: string | null
}
