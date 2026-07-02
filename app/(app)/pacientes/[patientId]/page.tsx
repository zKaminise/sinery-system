import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/current-user"
import {
  canEditPatient,
  canChangePatientStatus,
  canArchivePatient,
} from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { PatientDetails } from "@/components/patients/patient-details"
import type { PatientAppointmentSummary } from "@/components/patients/patient-details"

export const metadata: Metadata = {
  title: "Detalhes do paciente — Sinery System",
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    // Not a direct redirect("/login") — see app/(app)/layout.tsx.
    redirect("/api/auth/clear-session")
  }

  const { patientId } = await params

  // Tenant guard: looking up by id + clinicId together means a patient from
  // another clinic simply doesn't exist from this user's point of view —
  // notFound() below never reveals whether the id belongs to someone else.
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: user.clinicId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      document: true,
      birthDate: true,
      source: true,
      notes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      appointments: {
        orderBy: { startAt: "desc" },
        take: 10,
        select: {
          id: true,
          startAt: true,
          status: true,
          service: { select: { name: true } },
          professional: { select: { name: true } },
        },
      },
    },
  })

  if (!patient) {
    notFound()
  }

  const appointments: PatientAppointmentSummary[] = patient.appointments.map((a) => ({
    id: a.id,
    startAt: a.startAt.toISOString(),
    status: a.status,
    serviceName: a.service?.name ?? null,
    professionalName: a.professional.name,
  }))

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/pacientes"><ArrowLeft className="size-4" /> Voltar para pacientes</Link>}
      />

      <PatientDetails
        patient={{
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
          document: patient.document,
          birthDate: patient.birthDate ? patient.birthDate.toISOString() : null,
          source: patient.source,
          notes: patient.notes,
          status: patient.status,
          createdAt: patient.createdAt.toISOString(),
          updatedAt: patient.updatedAt.toISOString(),
        }}
        appointments={appointments}
        canEdit={canEditPatient(user.role)}
        canChangeStatus={canChangePatientStatus(user.role)}
        canArchive={canArchivePatient(user.role)}
      />
    </div>
  )
}
