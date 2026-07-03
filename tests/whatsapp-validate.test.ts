import { describe, it, expect } from "vitest"

import { validateWhatsAppConfig, type WhatsAppSafeConfig } from "@/lib/whatsapp/whatsapp-validate"

function cfg(overrides: Partial<WhatsAppSafeConfig> = {}): WhatsAppSafeConfig {
  return {
    enabled: false,
    graphApiVersion: "v20.0",
    hasAccessToken: false,
    hasPhoneNumberId: false,
    hasBusinessAccountId: false,
    hasAppId: false,
    hasAppSecret: false,
    hasWebhookVerifyToken: false,
    webhookPath: "/api/webhooks/whatsapp",
    sendMessagesEnabled: false,
    webhookEnabled: false,
    ...overrides,
  }
}

describe("validateWhatsAppConfig", () => {
  it("NOT_CONFIGURED with no env at all", () => {
    const r = validateWhatsAppConfig(cfg())
    expect(r.status).toBe("NOT_CONFIGURED")
    expect(r.ok).toBe(false)
  })

  it("DISABLED when credentials present but not enabled", () => {
    const r = validateWhatsAppConfig(cfg({ hasAccessToken: true, hasPhoneNumberId: true, enabled: false }))
    expect(r.status).toBe("DISABLED")
  })

  it("INVALID_CONFIG when enabled but missing token", () => {
    const r = validateWhatsAppConfig(cfg({ enabled: true, hasPhoneNumberId: true }))
    expect(r.status).toBe("INVALID_CONFIG")
    expect(r.issues.length).toBeGreaterThan(0)
    expect(r.ok).toBe(false)
  })

  it("CONFIGURED when enabled with core credentials and nothing else", () => {
    const r = validateWhatsAppConfig(cfg({ enabled: true, hasAccessToken: true, hasPhoneNumberId: true, hasBusinessAccountId: true }))
    expect(r.status).toBe("CONFIGURED")
    expect(r.ok).toBe(true)
  })

  it("INVALID_CONFIG when send enabled without token", () => {
    const r = validateWhatsAppConfig(cfg({ enabled: true, hasPhoneNumberId: true, sendMessagesEnabled: true }))
    expect(r.status).toBe("INVALID_CONFIG")
  })

  it("INVALID_CONFIG when webhook enabled without verify token", () => {
    const r = validateWhatsAppConfig(cfg({ enabled: true, hasAccessToken: true, hasPhoneNumberId: true, webhookEnabled: true }))
    expect(r.status).toBe("INVALID_CONFIG")
  })

  it("READY_FOR_WEBHOOK when webhook prerequisites present", () => {
    const r = validateWhatsAppConfig(
      cfg({ enabled: true, hasAccessToken: true, hasPhoneNumberId: true, webhookEnabled: true, hasWebhookVerifyToken: true, hasAppSecret: true })
    )
    expect(r.status).toBe("READY_FOR_WEBHOOK")
  })

  it("READY_FOR_SEND when send enabled with core credentials", () => {
    const r = validateWhatsAppConfig(
      cfg({ enabled: true, hasAccessToken: true, hasPhoneNumberId: true, sendMessagesEnabled: true })
    )
    expect(r.status).toBe("READY_FOR_SEND")
  })
})
