import { listPlansForFounder } from "@/lib/platform/founder-queries"
import { PlansManager } from "@/components/founder/plans-manager"

export const metadata = { title: "Planos — Sinery Founder" }

export default async function FounderPlansPage() {
  const plans = await listPlansForFounder()
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Planos</h2>
        <p className="text-sm text-muted-foreground">Planos comerciais oferecidos às clínicas.</p>
      </div>
      <PlansManager
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          priceInCents: p.priceInCents,
          billingInterval: p.billingInterval,
          includesAi: p.includesAi,
          includesWhatsapp: p.includesWhatsapp,
          active: p.active,
        }))}
      />
    </div>
  )
}
