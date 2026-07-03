import "server-only"

import { prisma } from "@/lib/prisma"
import { isWithinWhatsAppServiceWindow } from "@/lib/whatsapp/whatsapp-window"

/**
 * The timestamp of the patient's most recent inbound WhatsApp message in a
 * conversation (uses the WhatsApp `externalTimestamp` when present, else the
 * row's createdAt). Null when there is no inbound patient message.
 */
export async function getLastInboundWhatsAppMessageAt(
  clinicId: string,
  conversationId: string
): Promise<Date | null> {
  const last = await prisma.message.findFirst({
    where: {
      clinicId,
      conversationId,
      direction: "INBOUND",
      senderType: "PATIENT",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, externalTimestamp: true },
  })
  if (!last) return null
  return last.externalTimestamp ?? last.createdAt
}

/** Server convenience: whether a free-form text may be sent to this conversation now. */
export async function canSendFreeFormWhatsApp(
  clinicId: string,
  conversationId: string,
  requireWindow: boolean
): Promise<boolean> {
  const lastInboundAt = await getLastInboundWhatsAppMessageAt(clinicId, conversationId)
  return isWithinWhatsAppServiceWindow(lastInboundAt, new Date(), requireWindow)
}
