import type { PatientStatus } from "@/lib/generated/prisma/client"

export interface PatientRow {
  id: string
  name: string
  phone: string
  email: string | null
  document: string | null
  birthDate: string | null
  source: string | null
  notes: string | null
  status: PatientStatus
  createdAt: string
}

export interface PatientDetail extends PatientRow {
  updatedAt: string
}
