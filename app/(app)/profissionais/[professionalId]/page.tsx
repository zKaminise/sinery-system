import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/current-user"
import {
  canEditProfessional,
  canChangeProfessionalStatus,
  canManageWorkingHours,
  canManageProfessionalServices,
} from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { ProfessionalDetails } from "@/components/professionals/professional-details"

export const metadata: Metadata = {
  title: "Detalhes do profissional — Sinery System",
}

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ professionalId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    // Not a direct redirect("/login") — see app/(app)/layout.tsx.
    redirect("/api/auth/clear-session")
  }

  const { professionalId } = await params

  // Tenant guard: looking up by id + clinicId together means a professional
  // from another clinic simply doesn't exist from this user's point of view.
  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId: user.clinicId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      workingHours: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, active: true },
      },
      services: {
        select: {
          id: true,
          service: { select: { id: true, name: true, durationMinutes: true, status: true } },
        },
      },
    },
  })

  if (!professional) {
    notFound()
  }

  // All clinic services, used to populate the "link a new service" select —
  // scoped to clinicId the same as everything else on this page.
  const allServices = await prisma.service.findMany({
    where: { clinicId: user.clinicId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/profissionais"><ArrowLeft className="size-4" /> Voltar para profissionais</Link>}
      />

      <ProfessionalDetails
        professional={{
          id: professional.id,
          name: professional.name,
          email: professional.email,
          phone: professional.phone,
          specialty: professional.specialty,
          status: professional.status,
          createdAt: professional.createdAt.toISOString(),
          updatedAt: professional.updatedAt.toISOString(),
          workingHours: professional.workingHours,
          services: professional.services.map((link) => ({
            linkId: link.id,
            serviceId: link.service.id,
            name: link.service.name,
            durationMinutes: link.service.durationMinutes,
            status: link.service.status,
          })),
        }}
        availableServices={allServices}
        canEdit={canEditProfessional(user.role)}
        canChangeStatus={canChangeProfessionalStatus(user.role)}
        canManageWorkingHours={canManageWorkingHours(user.role)}
        canManageServices={canManageProfessionalServices(user.role)}
      />
    </div>
  )
}
