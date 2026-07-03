/**
 * PURE delivery-status ranking so a Message never regresses. Meta status
 * webhooks can arrive out of order (a late `delivered` after `read`), so we
 * only apply an incoming status if it advances the lifecycle.
 */
export type DeliveryStatus =
  | "INTERNAL_ONLY"
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "MOCK_SENT"

/** Progress rank. SENT/MOCK_SENT/FAILED share rank 2; DELIVERED 3; READ 4. */
const RANK: Record<DeliveryStatus, number> = {
  INTERNAL_ONLY: 0,
  PENDING: 1,
  SENT: 2,
  MOCK_SENT: 2,
  FAILED: 2,
  DELIVERED: 3,
  READ: 4,
}

/** Maps a WhatsApp webhook status string to our DeliveryStatus. */
export function mapWebhookStatus(status: string): DeliveryStatus | null {
  switch (status) {
    case "sent":
      return "SENT"
    case "delivered":
      return "DELIVERED"
    case "read":
      return "READ"
    case "failed":
      return "FAILED"
    default:
      return null
  }
}

/**
 * Given the current delivery status and an incoming one, returns the status to
 * persist, or null when it should be ignored (no regression / no change).
 * Rules: normal statuses advance only if their rank is higher; FAILED applies
 * only if not already DELIVERED/READ; a late DELIVERED/READ can still overwrite
 * a FAILED (the message actually got through).
 */
export function applyDeliveryStatus(
  current: DeliveryStatus | null | undefined,
  incoming: DeliveryStatus
): DeliveryStatus | null {
  const cur = current ?? "PENDING"
  if (cur === incoming) return null

  if (incoming === "FAILED") {
    // Only fail if not yet delivered/read.
    return RANK[cur] < RANK.DELIVERED ? "FAILED" : null
  }

  return RANK[incoming] > RANK[cur] ? incoming : null
}
