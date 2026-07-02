import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/current-user"
import { canEditService, canChangeServiceStatus } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { ServiceDetails } from "@/components/services/service-details"

export const metadata: Metadata = {
  title: "Detalhes do serviço — Sinery System",
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    // Not a direct redirect("/login") — see app/(app)/layout.tsx.
    redirect("/api/auth/clear-session")
  }

  const { serviceId } = await params

  // Tenant guard: looking up by id + clinicId together means a service from
  // another clinic simply doesn't exist from this user's point of view.
  const service = await prisma.service.findFirst({
    where: { id: serviceId, clinicId: user.clinicId },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      priceInCents: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      professionals: {
        select: {
          id: true,
          professional: { select: { id: true, name: true, specialty: true, status: true } },
        },
      },
    },
  })

  if (!service) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/servicos"><ArrowLeft className="size-4" /> Voltar para serviços</Link>}
      />

      <ServiceDetails
        service={{
          id: service.id,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          priceInCents: service.priceInCents,
          status: service.status,
          createdAt: service.createdAt.toISOString(),
          updatedAt: service.updatedAt.toISOString(),
          professionals: service.professionals.map((link) => ({
            linkId: link.id,
            professionalId: link.professional.id,
            name: link.professional.name,
            specialty: link.professional.specialty,
            status: link.professional.status,
          })),
        }}
        canEdit={canEditService(user.role)}
        canChangeStatus={canChangeServiceStatus(user.role)}
      />
    </div>
  )
}
