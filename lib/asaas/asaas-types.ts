/**
 * Public Asaas types (re-exported from the client/webhook modules so callers can
 * import shapes from one place).
 */
export type { AsaasCustomer, AsaasSubscriptionResult, AsaasPayment } from "@/lib/asaas/asaas-client"
export type { ParsedAsaasEvent } from "@/lib/asaas/asaas-webhook"
export type { BillingIntervalValue } from "@/lib/asaas/asaas-mappers"

/** Asaas payment statuses we care about. */
export type AsaasPaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "RECEIVED"
  | "OVERDUE"
  | "REFUNDED"
  | "DELETED"
  | "AWAITING_RISK_ANALYSIS"

/** Asaas webhook event types handled by the integration. */
export type AsaasEventType =
  | "PAYMENT_CREATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_AWAITING_RISK_ANALYSIS"
