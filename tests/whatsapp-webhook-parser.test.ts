import { describe, it, expect } from "vitest"

import { parseWhatsAppWebhookPayload } from "@/lib/whatsapp/whatsapp-webhook-parser"
import { normalizeWhatsAppPhone, phonesMatch } from "@/lib/whatsapp/whatsapp-phone"
import { checkWebhookVerification } from "@/lib/whatsapp/whatsapp-webhook-verify"
import { MEDIA_FALLBACK_TEXT } from "@/lib/whatsapp/whatsapp-webhook-types"

function textPayload(overrides: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "5534999990000", phone_number_id: "PHONE_123" },
              contacts: [{ profile: { name: "João Paciente" }, wa_id: "5534999990000" }],
              messages: [
                { from: "5534999990000", id: "wamid.ABC", timestamp: "1710000000", type: "text", text: { body: "Olá, quero marcar" } },
              ],
              ...overrides,
            },
          },
        ],
      },
    ],
  }
}

describe("parseWhatsAppWebhookPayload", () => {
  it("extracts a text message + phoneNumberId + contact + from", () => {
    const { events } = parseWhatsAppWebhookPayload(textPayload())
    expect(events).toHaveLength(1)
    const e = events[0]
    expect(e.kind).toBe("message")
    if (e.kind === "message") {
      expect(e.phoneNumberId).toBe("PHONE_123")
      expect(e.fromPhone).toBe("5534999990000")
      expect(e.contactName).toBe("João Paciente")
      expect(e.whatsappMessageId).toBe("wamid.ABC")
      expect(e.messageType).toBe("text")
      expect(e.text).toBe("Olá, quero marcar")
    }
  })

  it("uses a media fallback for image messages", () => {
    const { events } = parseWhatsAppWebhookPayload(
      textPayload({ messages: [{ from: "5534999990000", id: "wamid.IMG", timestamp: "1710000000", type: "image", image: { id: "media-1" } }] })
    )
    const e = events[0]
    expect(e.kind).toBe("message")
    if (e.kind === "message") {
      expect(e.text).toBe(MEDIA_FALLBACK_TEXT)
      expect(e.messageType).toBe("image")
      expect(e.rawTypeMetadata).toMatchObject({ type: "image", mediaId: "media-1" })
    }
  })

  it("extracts a status event", () => {
    const { events } = parseWhatsAppWebhookPayload(
      textPayload({ messages: undefined, statuses: [{ id: "wamid.ABC", status: "delivered", timestamp: "1710000005", recipient_id: "5534999990000" }] })
    )
    const e = events[0]
    expect(e.kind).toBe("status")
    if (e.kind === "status") {
      expect(e.status).toBe("delivered")
      expect(e.whatsappMessageId).toBe("wamid.ABC")
    }
  })

  it("does not throw on an empty payload", () => {
    expect(parseWhatsAppWebhookPayload({}).events).toHaveLength(0)
    expect(parseWhatsAppWebhookPayload(null).ignoredReasons).toContain("not_an_object")
  })

  it("ignores unknown structures gracefully", () => {
    const r = parseWhatsAppWebhookPayload({ object: "page", entry: [{ changes: [{ value: {} }] }] })
    expect(r.events).toHaveLength(0)
    expect(r.ignoredReasons.length).toBeGreaterThan(0)
  })
})

describe("normalizeWhatsAppPhone / phonesMatch", () => {
  it("strips non-digits", () => {
    expect(normalizeWhatsAppPhone("+55 (34) 99999-0000")).toBe("5534999990000")
  })
  it("empty for garbage", () => {
    expect(normalizeWhatsAppPhone("abc")).toBe("")
  })
  it("matches by trailing digits despite formatting", () => {
    expect(phonesMatch("5534999990000", "+55 34 99999-0000")).toBe(true)
  })
  it("does not match different numbers", () => {
    expect(phonesMatch("5534999990000", "5534988887777")).toBe(false)
  })
})

describe("checkWebhookVerification", () => {
  const expectedToken = "fake-verify"
  it("ok with correct mode + token + challenge", () => {
    const r = checkWebhookVerification({ mode: "subscribe", token: "fake-verify", challenge: "12345", expectedToken })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.challenge).toBe("12345")
  })
  it("403 with wrong token", () => {
    const r = checkWebhookVerification({ mode: "subscribe", token: "wrong", challenge: "12345", expectedToken })
    expect(r).toMatchObject({ ok: false, status: 403 })
  })
  it("400 with wrong mode", () => {
    const r = checkWebhookVerification({ mode: "unsubscribe", token: "fake-verify", challenge: "12345", expectedToken })
    expect(r).toMatchObject({ ok: false, status: 400 })
  })
  it("400 with missing challenge", () => {
    const r = checkWebhookVerification({ mode: "subscribe", token: "fake-verify", challenge: null, expectedToken })
    expect(r).toMatchObject({ ok: false, status: 400 })
  })
})
