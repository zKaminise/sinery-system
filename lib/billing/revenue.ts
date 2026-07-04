/**
 * Revenue math (pure — unit-testable). All amounts are integer cents.
 * MRR = sum of the monthly-normalized amount of revenue-generating subscriptions.
 */

import type { SubscriptionStatusValue } from "@/lib/billing/subscription-status"

export type BillingIntervalValue = "FREE" | "MONTHLY" | "YEARLY" | "ONE_TIME" | "CUSTOM"

/** Normalizes an amount to a monthly figure (cents) for MRR purposes. */
export function monthlyAmountInCents(amountInCents: number, interval: BillingIntervalValue): number {
  const amount = Math.max(0, Math.round(amountInCents || 0))
  switch (interval) {
    case "MONTHLY":
      return amount
    case "YEARLY":
      return Math.round(amount / 12)
    case "CUSTOM":
      return amount // treated as a monthly-equivalent figure
    case "FREE":
    case "ONE_TIME":
    default:
      return 0
  }
}

/** Statuses that count toward recurring revenue (contracted + still owed). */
export function isRevenueGenerating(status: SubscriptionStatusValue): boolean {
  return status === "ACTIVE" || status === "PAST_DUE"
}

export interface RevenueSubscription {
  amountInCents: number
  interval: BillingIntervalValue
  status: SubscriptionStatusValue
}

/** Monthly Recurring Revenue (cents) across revenue-generating subscriptions. */
export function computeMrrInCents(subscriptions: RevenueSubscription[]): number {
  return subscriptions.reduce((sum, s) => {
    if (!isRevenueGenerating(s.status)) return sum
    return sum + monthlyAmountInCents(s.amountInCents, s.interval)
  }, 0)
}

/** Annual Recurring Revenue (cents) = MRR × 12. */
export function computeArrInCents(mrrInCents: number): number {
  return Math.max(0, Math.round(mrrInCents)) * 12
}

/** Formats integer cents as BRL (e.g. 39700 → "R$ 397,00"). */
export function formatCentsBRL(cents: number): string {
  return (Math.round(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}
