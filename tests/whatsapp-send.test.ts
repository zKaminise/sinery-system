import { describe, it, expect } from "vitest"

import { parseWhatsAppSendResponse, sanitizeWhatsAppApiError } from "@/lib/whatsapp/whatsapp-send-response"
import { applyDeliveryStatus, mapWebhookStatus } from "@/lib/whatsapp/whatsapp-delivery-status"
import { isWithinWhatsAppServiceWindow } from "@/lib/whatsapp/whatsapp-window"
import { canSendWhatsAppMessage } from "@/lib/permissions"

describe("parseWhatsAppSendResponse", () => {
  it("success → whatsappMessageId", () => {
    const r = parseWhatsAppSendResponse({ messaging_product: "whatsapp", contacts: [{ wa_id: "5534999990000" }], messages: [{ id: "wamid.OUT1" }] })
    expect(r.ok).toBe(true)
    expect(r.whatsappMessageId).toBe("wamid.OUT1")
    expect(r.rawContactWaId).toBe("5534999990000")
  })
  it("Graph error → code + message", () => {
    const r = parseWhatsAppSendResponse({ error: { code: 131047, message: "Re-engagement message" } })
    expect(r.ok).toBe(false)
    expect(r.errorCode).toBe("131047")
  })
  it("unexpected payload → not ok", () => {
    expect(parseWhatsAppSendResponse({}).ok).toBe(false)
    expect(parseWhatsAppSendResponse(null).ok).toBe(false)
  })
})

describe("sanitizeWhatsAppApiError", () => {
  it("strips a Meta token and Bearer header", () => {
    const { message } = sanitizeWhatsAppApiError("failed with Authorization: Bearer EAABsecret12345 and token EAAxyz999")
    expect(message).not.toContain("EAABsecret12345")
    expect(message).not.toContain("EAAxyz999")
    expect(message).toContain("[redacted")
  })
  it("keeps a safe error code", () => {
    expect(sanitizeWhatsAppApiError(new Error("request aborted")).code).toBe("timeout")
    expect(sanitizeWhatsAppApiError("boom").code).toBe("graph_api_error")
  })
})

describe("applyDeliveryStatus", () => {
  it("advances SENT → DELIVERED → READ", () => {
    expect(applyDeliveryStatus("SENT", "DELIVERED")).toBe("DELIVERED")
    expect(applyDeliveryStatus("DELIVERED", "READ")).toBe("READ")
  })
  it("does not regress READ → DELIVERED", () => {
    expect(applyDeliveryStatus("READ", "DELIVERED")).toBeNull()
  })
  it("FAILED overwrites SENT but not READ", () => {
    expect(applyDeliveryStatus("SENT", "FAILED")).toBe("FAILED")
    expect(applyDeliveryStatus("READ", "FAILED")).toBeNull()
    expect(applyDeliveryStatus("DELIVERED", "FAILED")).toBeNull()
  })
  it("no change for same status", () => {
    expect(applyDeliveryStatus("READ", "READ")).toBeNull()
  })
  it("maps webhook status strings", () => {
    expect(mapWebhookStatus("delivered")).toBe("DELIVERED")
    expect(mapWebhookStatus("bogus")).toBeNull()
  })
})

describe("isWithinWhatsAppServiceWindow", () => {
  const now = new Date("2026-07-03T12:00:00Z")
  it("allows within 24h", () => {
    expect(isWithinWhatsAppServiceWindow(new Date("2026-07-03T00:00:00Z"), now, true)).toBe(true)
  })
  it("blocks past 24h", () => {
    expect(isWithinWhatsAppServiceWindow(new Date("2026-07-01T00:00:00Z"), now, true)).toBe(false)
  })
  it("blocks when there is no inbound", () => {
    expect(isWithinWhatsAppServiceWindow(null, now, true)).toBe(false)
  })
  it("allows anything when requireWindow=false (dev)", () => {
    expect(isWithinWhatsAppServiceWindow(null, now, false)).toBe(true)
  })
})

describe("canSendWhatsAppMessage", () => {
  it("OWNER/ADMIN/RECEPTIONIST can send", () => {
    expect(canSendWhatsAppMessage("OWNER")).toBe(true)
    expect(canSendWhatsAppMessage("ADMIN")).toBe(true)
    expect(canSendWhatsAppMessage("RECEPTIONIST")).toBe(true)
  })
  it("PROFESSIONAL cannot send", () => {
    expect(canSendWhatsAppMessage("PROFESSIONAL")).toBe(false)
  })
})
