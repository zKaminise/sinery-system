import { describe, it, expect } from "vitest"

import {
  shouldAutoProcessWhatsAppInbound,
  assistReplyTarget,
  withinAutoReplyRateLimit,
  isAssistProcessableMessage,
} from "@/lib/whatsapp/whatsapp-assist-decisions"

const base = {
  channel: "WHATSAPP",
  direction: "INBOUND",
  senderType: "PATIENT",
  conversationStatus: "AI_HANDLING",
  autoProcessAssist: true,
  aiSettingsEnabled: true,
  globalDisabled: false,
}

describe("shouldAutoProcessWhatsAppInbound", () => {
  it("true for AI_HANDLING inbound patient with flags on", () => {
    expect(shouldAutoProcessWhatsAppInbound(base)).toBe(true)
  })
  it("false for HUMAN_HANDLING", () => {
    expect(shouldAutoProcessWhatsAppInbound({ ...base, conversationStatus: "HUMAN_HANDLING" })).toBe(false)
  })
  it("false for WAITING_HUMAN", () => {
    expect(shouldAutoProcessWhatsAppInbound({ ...base, conversationStatus: "WAITING_HUMAN" })).toBe(false)
  })
  it("false for CLOSED", () => {
    expect(shouldAutoProcessWhatsAppInbound({ ...base, conversationStatus: "CLOSED" })).toBe(false)
  })
  it("false when auto-process off", () => {
    expect(shouldAutoProcessWhatsAppInbound({ ...base, autoProcessAssist: false })).toBe(false)
  })
  it("false when AiSettings disabled", () => {
    expect(shouldAutoProcessWhatsAppInbound({ ...base, aiSettingsEnabled: false })).toBe(false)
  })
  it("false when global disabled", () => {
    expect(shouldAutoProcessWhatsAppInbound({ ...base, globalDisabled: true })).toBe(false)
  })
  it("false for outbound / non-patient", () => {
    expect(shouldAutoProcessWhatsAppInbound({ ...base, direction: "OUTBOUND" })).toBe(false)
    expect(shouldAutoProcessWhatsAppInbound({ ...base, senderType: "AI" })).toBe(false)
  })
})

describe("assistReplyTarget", () => {
  it("SEND when reply+send enabled, in window, no mock", () => {
    expect(assistReplyTarget({ replyEnabled: true, sendEnabled: true, mockMode: false, withinWindow: true })).toBe("SEND")
  })
  it("MOCK when mock mode", () => {
    expect(assistReplyTarget({ replyEnabled: true, sendEnabled: true, mockMode: true, withinWindow: true })).toBe("MOCK")
  })
  it("INTERNAL_ONLY when reply disabled", () => {
    expect(assistReplyTarget({ replyEnabled: false, sendEnabled: true, mockMode: true, withinWindow: true })).toBe("INTERNAL_ONLY")
  })
  it("INTERNAL_ONLY when send disabled", () => {
    expect(assistReplyTarget({ replyEnabled: true, sendEnabled: false, mockMode: true, withinWindow: true })).toBe("INTERNAL_ONLY")
  })
  it("INTERNAL_ONLY when out of window", () => {
    expect(assistReplyTarget({ replyEnabled: true, sendEnabled: true, mockMode: true, withinWindow: false })).toBe("INTERNAL_ONLY")
  })
})

describe("withinAutoReplyRateLimit", () => {
  it("allows below the limit", () => {
    expect(withinAutoReplyRateLimit(5, 20)).toBe(true)
  })
  it("blocks at/over the limit", () => {
    expect(withinAutoReplyRateLimit(20, 20)).toBe(false)
  })
  it("unlimited when limit <= 0", () => {
    expect(withinAutoReplyRateLimit(9999, 0)).toBe(true)
  })
})

describe("isAssistProcessableMessage", () => {
  it("only inbound patient", () => {
    expect(isAssistProcessableMessage("INBOUND", "PATIENT")).toBe(true)
    expect(isAssistProcessableMessage("OUTBOUND", "AI")).toBe(false)
    expect(isAssistProcessableMessage("OUTBOUND", "HUMAN")).toBe(false)
    expect(isAssistProcessableMessage("INBOUND", "SYSTEM")).toBe(false)
  })
})
