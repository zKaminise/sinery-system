/** Pure mappers between Sinery billing and Asaas concepts. */

export type BillingIntervalValue = "FREE" | "MONTHLY" | "YEARLY" | "ONE_TIME" | "CUSTOM"

/** Asaas subscription cycle, or null when the interval isn't subscribable. */
export function billingIntervalToAsaasCycle(interval: BillingIntervalValue): "MONTHLY" | "YEARLY" | null {
  if (interval === "MONTHLY") return "MONTHLY"
  if (interval === "YEARLY") return "YEARLY"
  return null
}

/** Months to advance the next due date for a given interval. */
export function intervalAdvanceMonths(interval: BillingIntervalValue): number {
  return interval === "YEARLY" ? 12 : 1
}
