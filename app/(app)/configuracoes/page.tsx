import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { getCurrentUser, getCurrentUserClinic } from "@/lib/current-user"
import { canManageClinicSettings, canManageUsers } from "@/lib/permissions"
import { SettingsTabs } from "@/components/settings/settings-tabs"

export const metadata: Metadata = {
  title: "Configurações — Sinery System",
}

export default async function ConfiguracoesPage() {
  const user = await getCurrentUser()
  if (!user) {
    // Not a direct redirect("/login") — see app/(app)/layout.tsx for why a
    // stale-but-signature-valid cookie must be cleared first to avoid a
    // /login <-> /dashboard redirect loop.
    redirect("/api/auth/clear-session")
  }

  const clinic = await getCurrentUserClinic()
  if (!clinic) {
    redirect("/api/auth/clear-session")
  }

  const canManage = canManageClinicSettings(user)
  const canUsers = canManageUsers(user)

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: clinic.id },
  })

  // Only fetch the user list for those allowed to manage users.
  const users = canUsers
    ? await prisma.user.findMany({
        where: { clinicId: clinic.id },
        orderBy: [{ status: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          temporaryPassword: true,
          firstLoginAt: true,
          passwordChangedAt: true,
          createdAt: true,
        },
      })
    : []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configurações</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie os dados da clínica, usuários e preferências do sistema.
        </p>
      </div>

      <SettingsTabs
        currentUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }}
        canManage={canManage}
        canManageUsers={canUsers}
        clinic={{
          id: clinic.id,
          name: clinic.name,
          legalName: clinic.legalName,
          document: clinic.document,
          segment: clinic.segment,
          email: clinic.email,
          phone: clinic.phone,
          whatsapp: clinic.whatsapp,
          address: clinic.address,
          city: clinic.city,
          state: clinic.state,
          logoUrl: clinic.logoUrl,
          status: clinic.status,
        }}
        settings={{
          timezone: settings?.timezone ?? "America/Sao_Paulo",
          businessStartHour: settings?.businessStartHour ?? 8,
          businessEndHour: settings?.businessEndHour ?? 18,
          appointmentSlotMinutes: settings?.appointmentSlotMinutes ?? 30,
          allowAiScheduling: settings?.allowAiScheduling ?? false,
          allowAiRescheduling: settings?.allowAiRescheduling ?? false,
          allowAiCancellation: settings?.allowAiCancellation ?? false,
          aiTone: settings?.aiTone ?? "professional",
        }}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          temporaryPassword: u.temporaryPassword,
          firstLoginAt: u.firstLoginAt ? u.firstLoginAt.toISOString() : null,
          passwordChangedAt: u.passwordChangedAt ? u.passwordChangedAt.toISOString() : null,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
