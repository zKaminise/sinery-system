import "server-only"

import { prisma } from "@/lib/prisma"
import { getEvolutionSecrets } from "@/lib/evolution/evolution-config"

export interface ResolvedEvolutionIntegration {
  id: string
  clinicId: string
  enabled: boolean
  provider: string
  evolutionInstanceName: string | null
}

/**
 * Resolves the clinic that owns an Evolution `instanceName`. The instanceName is
 * the ONLY thing the webhook trusts to find the clinic — clinicId NEVER comes
 * from the webhook body. A given instanceName maps to exactly one clinic
 * (unique constraint). Returns null when unknown (webhook then ignores safely).
 */
export async function resolveClinicByEvolutionInstance(instanceName: string): Promise<ResolvedEvolutionIntegration | null> {
  const name = instanceName.trim()
  if (!name) return null

  const integration = await prisma.whatsAppIntegration.findFirst({
    where: { evolutionInstanceName: name, enabled: true },
    select: { id: true, clinicId: true, enabled: true, provider: true, evolutionInstanceName: true },
  })
  if (integration) return integration

  // Documented DEV fallback: the env EVOLUTION_INSTANCE_NAME matches and there is
  // exactly one enabled integration — use it (lets local testing work before a
  // config sync). Never used with multiple clinics.
  const envInstance = getEvolutionSecrets().instanceName
  if (envInstance && envInstance === name) {
    const all = await prisma.whatsAppIntegration.findMany({
      where: { enabled: true },
      select: { id: true, clinicId: true, enabled: true, provider: true, evolutionInstanceName: true },
    })
    if (all.length === 1) return all[0]
  }
  return null
}
