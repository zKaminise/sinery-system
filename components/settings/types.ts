import type {
  ClinicSegment,
  ClinicStatus,
  UserRole,
  UserStatus,
} from "@/lib/generated/prisma/client"

export interface SettingsCurrentUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface SettingsClinic {
  id: string
  name: string
  legalName: string | null
  document: string | null
  segment: ClinicSegment
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  city: string | null
  state: string | null
  logoUrl: string | null
  status: ClinicStatus
}

export interface SettingsOperation {
  timezone: string
  businessStartHour: number
  businessEndHour: number
  appointmentSlotMinutes: number
  allowAiScheduling: boolean
  allowAiRescheduling: boolean
  allowAiCancellation: boolean
  aiTone: string
}

export interface SettingsUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  temporaryPassword: boolean
  firstLoginAt: string | null
  passwordChangedAt: string | null
  createdAt: string
}
