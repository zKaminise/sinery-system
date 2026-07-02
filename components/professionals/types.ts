import type { ProfessionalStatus } from "@/lib/generated/prisma/client"

export interface ProfessionalRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  specialty: string | null
  status: ProfessionalStatus
  servicesCount: number
  createdAt: string
}

export interface ProfessionalWorkingHour {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  active: boolean
}

export interface ProfessionalLinkedService {
  linkId: string
  serviceId: string
  name: string
  durationMinutes: number
  status: string
}

export interface ProfessionalDetail {
  id: string
  name: string
  email: string | null
  phone: string | null
  specialty: string | null
  status: ProfessionalStatus
  createdAt: string
  updatedAt: string
  workingHours: ProfessionalWorkingHour[]
  services: ProfessionalLinkedService[]
}
