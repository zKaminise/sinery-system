import type { ServiceStatus } from "@/lib/generated/prisma/client"

export interface ServiceRow {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceInCents: number | null
  status: ServiceStatus
  professionalsCount: number
  createdAt: string
}

export interface ServiceLinkedProfessional {
  linkId: string
  professionalId: string
  name: string
  specialty: string | null
  status: string
}

export interface ServiceDetail {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceInCents: number | null
  status: ServiceStatus
  createdAt: string
  updatedAt: string
  professionals: ServiceLinkedProfessional[]
}
