"use client"

import { Building2, Sliders, Users, ShieldCheck } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClinicSettingsForm } from "@/components/settings/clinic-settings-form"
import { OperationSettingsForm } from "@/components/settings/operation-settings-form"
import { UsersManagement } from "@/components/settings/users-management"
import { SecuritySettings } from "@/components/settings/security-settings"
import { AccessDenied } from "@/components/common/access-denied"
import type {
  SettingsClinic,
  SettingsCurrentUser,
  SettingsOperation,
  SettingsUser,
} from "@/components/settings/types"

interface SettingsTabsProps {
  currentUser: SettingsCurrentUser
  canManage: boolean
  canManageUsers: boolean
  clinic: SettingsClinic
  settings: SettingsOperation
  users: SettingsUser[]
}

export function SettingsTabs({
  currentUser,
  canManage,
  canManageUsers,
  clinic,
  settings,
  users,
}: SettingsTabsProps) {
  return (
    <Tabs defaultValue="clinica" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="clinica">
          <Building2 className="size-4" />
          Clínica
        </TabsTrigger>
        <TabsTrigger value="operacao">
          <Sliders className="size-4" />
          Operação
        </TabsTrigger>
        <TabsTrigger value="usuarios">
          <Users className="size-4" />
          Usuários
        </TabsTrigger>
        <TabsTrigger value="seguranca">
          <ShieldCheck className="size-4" />
          Segurança
        </TabsTrigger>
      </TabsList>

      <TabsContent value="clinica" className="mt-4">
        <ClinicSettingsForm clinic={clinic} canManage={canManage} />
      </TabsContent>

      <TabsContent value="operacao" className="mt-4">
        <OperationSettingsForm settings={settings} canManage={canManage} />
      </TabsContent>

      <TabsContent value="usuarios" className="mt-4">
        {canManageUsers ? (
          <UsersManagement currentUser={currentUser} users={users} />
        ) : (
          <AccessDenied description="Apenas Owner e Admin podem gerenciar os usuários da clínica." />
        )}
      </TabsContent>

      <TabsContent value="seguranca" className="mt-4">
        <SecuritySettings currentUser={currentUser} />
      </TabsContent>
    </Tabs>
  )
}
