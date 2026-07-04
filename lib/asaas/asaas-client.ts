import "server-only"

import { getAsaasConfig, shouldCallAsaasReal } from "@/lib/asaas/asaas-config"

/**
 * Asaas API client (server-only). The API key is read ONLY here and sent as the
 * `access_token` header — never logged or exposed. In mock mode, returns
 * deterministic fake ids without any network call.
 */

function rand(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`
}

async function asaasFetch<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const cfg = getAsaasConfig()
  const key = (process.env.ASAAS_API_KEY ?? "").trim()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", access_token: key },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const errs = data.errors as Array<{ description?: string }> | undefined
      throw new Error(errs?.[0]?.description || `Asaas HTTP ${res.status}`)
    }
    return data as T
  } finally {
    clearTimeout(timeout)
  }
}

export interface AsaasCustomer {
  id: string
}

export async function createAsaasCustomer(input: {
  name: string
  email: string
  phone?: string
  cpfCnpj?: string
}): Promise<AsaasCustomer> {
  if (!shouldCallAsaasReal()) return { id: rand("mock_cus") }
  const data = await asaasFetch<{ id: string }>("/customers", "POST", {
    name: input.name,
    email: input.email,
    mobilePhone: input.phone,
    cpfCnpj: input.cpfCnpj,
  })
  return { id: data.id }
}

export interface AsaasSubscriptionResult {
  subscriptionId: string
  paymentId?: string
  invoiceUrl?: string
}

export async function createAsaasSubscription(input: {
  customerId: string
  valueInReais: number
  cycle: "MONTHLY" | "YEARLY"
  description: string
  externalReference: string
  nextDueDate: string // YYYY-MM-DD
}): Promise<AsaasSubscriptionResult> {
  if (!shouldCallAsaasReal()) {
    const paymentId = rand("mock_pay")
    return {
      subscriptionId: rand("mock_sub"),
      paymentId,
      invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout-mock/${paymentId}`,
    }
  }
  const data = await asaasFetch<{ id: string; invoiceUrl?: string }>("/subscriptions", "POST", {
    customer: input.customerId,
    billingType: "UNDEFINED",
    value: input.valueInReais,
    cycle: input.cycle,
    description: input.description,
    externalReference: input.externalReference,
    nextDueDate: input.nextDueDate,
  })
  return { subscriptionId: data.id, invoiceUrl: data.invoiceUrl }
}

export interface AsaasPayment {
  id: string
  status: string
  valueInCents: number
  subscriptionId?: string
  customerId?: string
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  if (!shouldCallAsaasReal()) return { id: paymentId, status: "CONFIRMED", valueInCents: 0 }
  const data = await asaasFetch<{ id: string; status: string; value: number; subscription?: string; customer?: string }>(
    `/payments/${paymentId}`,
    "GET"
  )
  return { id: data.id, status: data.status, valueInCents: Math.round((data.value ?? 0) * 100), subscriptionId: data.subscription, customerId: data.customer }
}
