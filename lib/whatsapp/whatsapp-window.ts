/**
 * PURE 24h service-window logic. WhatsApp only allows free-form (non-template)
 * messages within 24h of the patient's last inbound message. The server helper
 * (whatsapp-service-window.ts) loads the last inbound timestamp and calls this.
 */

export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

export const WHATSAPP_SERVICE_WINDOW_EXPIRED_MESSAGE =
  "A janela de atendimento de 24 horas expirou. O envio com template será implementado em etapa futura."

/**
 * Whether a free-form text message may be sent now. When `requireWindow` is
 * false (dev only), always allows. Otherwise requires a patient inbound within
 * the last 24h.
 */
export function isWithinWhatsAppServiceWindow(
  lastInboundAt: Date | null | undefined,
  now: Date,
  requireWindow: boolean
): boolean {
  if (!requireWindow) return true
  if (!lastInboundAt) return false
  return now.getTime() - lastInboundAt.getTime() <= WHATSAPP_SERVICE_WINDOW_MS
}
