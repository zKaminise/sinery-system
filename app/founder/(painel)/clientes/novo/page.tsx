import { listPlansForFounder } from "@/lib/platform/founder-queries"
import { CreateClinicForm } from "@/components/founder/create-clinic-form"

export const metadata = { title: "Nova clínica — Sinery Founder" }

export default async function NewClinicPage() {
  const plans = await listPlansForFounder()
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Nova clínica</h2>
        <p className="text-sm text-muted-foreground">Cadastro manual de um novo cliente da Sinery.</p>
      </div>
      <CreateClinicForm plans={plans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  )
}
