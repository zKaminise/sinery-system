import { describe, it, expect } from "vitest"

import {
  evaluateMessagingReadiness,
  type MessagingReadinessInput,
} from "@/lib/messaging/messaging-readiness"
import { decideSendProvider } from "@/lib/messaging/messaging-router"
import { normalizeMessagingProvider } from "@/lib/messaging/messaging-types"
import { buildMessagingEventHash } from "@/lib/messaging/messaging-idempotency"
import { normalizeEvolutionMessage, phoneFromRemoteJid } from "@/lib/messaging/messaging-normalizer"
import { authorizeEvolutionWebhook } from "@/lib/evolution/evolution-webhook-security"
import { parseEvolutionWebhook } from "@/lib/evolution/evolution-webhook-parser"
import { sanitizeEvolutionError } from "@/lib/evolution/evolution-errors"
import {
  buildEvolutionSendBody,
  mockEvolutionMessageId,
  parseEvolutionSendResponse,
} from "@/lib/evolution/evolution-send-client"

// ---------- Config / readiness (Part 15: 1-4) ----------
function readiness(overrides: Partial<MessagingReadinessInput> = {}): MessagingReadinessInput {
  return {
    appEnv: "staging",
    provider: "evolution",
    evolutionEnabled: true,
    hasEvolutionUrl: true,
    hasEvolutionKey: true,
    hasEvolutionInstance: true,
    hasEvolutionWebhookSecret: true,
    evolutionWebhookEnabled: true,
    evolutionSendMessagesEnabled: true,
    evolutionSendMockMode: false,
    evolutionAssistReplyEnabled: true,
    evolutionAllowedInProduction: false,
    ...overrides,
  }
}

describe("messaging readiness — Evolution per environment", () => {
  it("local permite evolution (sem critical)", () => {
    const r = evaluateMessagingReadiness(readiness({ appEnv: "local" }))
    expect(r.messagingProvider).toBe("EVOLUTION_API")
    expect(r.criticalIssues).toEqual([])
  })

  it("staging permite evolution (sem critical, com aviso test-only)", () => {
    const r = evaluateMessagingReadiness(readiness({ appEnv: "staging" }))
    expect(r.criticalIssues).toEqual([])
    expect(r.warnings.join(" ")).toContain("HML/testes")
  })

  it("production bloqueia evolution por padrão (critical)", () => {
    const r = evaluateMessagingReadiness(readiness({ appEnv: "production", evolutionAllowedInProduction: false }))
    expect(r.criticalIssues.join(" ")).toContain("produção")
  })

  it("production com provider evolution + allow=true ainda gera critical warning", () => {
    const r = evaluateMessagingReadiness(readiness({ appEnv: "production", evolutionAllowedInProduction: true }))
    expect(r.criticalIssues.length).toBeGreaterThan(0)
    expect(r.criticalIssues.join(" ")).toContain("PRODUÇÃO")
  })

  it("readiness nunca inclui valores de secret", () => {
    const r = evaluateMessagingReadiness(readiness())
    const s = JSON.stringify(r)
    expect(s).not.toContain("apikey")
    expect(s.toLowerCase()).not.toContain("secret-value")
  })
})

// ---------- Webhook security (Part 15: 5-9) ----------
describe("evolution webhook security", () => {
  const expectedSecret = "s3cr3t-token"
  it("header secret válido autoriza", () => {
    expect(authorizeEvolutionWebhook({ expectedSecret, headerSecret: expectedSecret, queryToken: null }).ok).toBe(true)
  })
  it("secret inválido rejeita (mismatch)", () => {
    const r = authorizeEvolutionWebhook({ expectedSecret, headerSecret: "wrong", queryToken: null })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe("mismatch")
  })
  it("secret ausente rejeita (missing)", () => {
    const r = authorizeEvolutionWebhook({ expectedSecret, headerSecret: null, queryToken: null })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe("missing")
  })
  it("query token válido autoriza", () => {
    expect(authorizeEvolutionWebhook({ expectedSecret, headerSecret: null, queryToken: expectedSecret }).ok).toBe(true)
  })
  it("sem secret configurado autoriza (dev)", () => {
    const r = authorizeEvolutionWebhook({ expectedSecret: "", headerSecret: null, queryToken: null })
    expect(r.ok).toBe(true)
    expect(r.ok && r.reason).toBe("no_secret_configured")
  })
})

// ---------- Parser (Part 15: 10-15) ----------
describe("evolution webhook parser", () => {
  const upsert = {
    event: "messages.upsert",
    instance: "sinery-hml",
    data: { key: { id: "MSG1", remoteJid: "5534999990000@s.whatsapp.net", fromMe: false }, pushName: "Ana", message: { conversation: "quero marcar limpeza" } },
  }

  it("messages.upsert com conversation extrai a mensagem", () => {
    const r = parseEvolutionWebhook(upsert)
    expect(r.messages).toHaveLength(1)
    expect(r.messages[0].text).toBe("quero marcar limpeza")
    expect(r.messages[0].keyId).toBe("MSG1")
  })

  it("extendedTextMessage é extraído", () => {
    const r = parseEvolutionWebhook({
      event: "messages.upsert",
      instance: "sinery-hml",
      data: { key: { id: "MSG2", remoteJid: "5534999990000@s.whatsapp.net", fromMe: false }, message: { extendedTextMessage: { text: "olá tudo bem?" } } },
    })
    expect(r.messages[0].text).toBe("olá tudo bem?")
  })

  it("fromMe=true é ignorado", () => {
    const r = parseEvolutionWebhook({ ...upsert, data: { ...upsert.data, key: { ...upsert.data.key, fromMe: true } } })
    expect(r.messages).toHaveLength(0)
    expect(r.droppedFromMe).toBe(1)
    expect(r.ignoredReason).toBe("all_ignored_from_me_or_group")
  })

  it("grupo @g.us é ignorado", () => {
    const r = parseEvolutionWebhook({ ...upsert, data: { ...upsert.data, key: { id: "MSGG", remoteJid: "123456@g.us", fromMe: false } } })
    expect(r.messages).toHaveLength(0)
    expect(r.droppedGroup).toBe(1)
  })

  it("payload desconhecido é ignorado com segurança", () => {
    expect(parseEvolutionWebhook({ event: "presence.update", data: { foo: "bar" } }).ignoredReason).toBe("unknown_event")
    expect(parseEvolutionWebhook(null).ignoredReason).toBe("unknown_payload")
    expect(parseEvolutionWebhook("nope").ignoredReason).toBe("unknown_payload")
  })

  it("instanceName é extraído (string ou objeto)", () => {
    expect(parseEvolutionWebhook(upsert).instanceName).toBe("sinery-hml")
    expect(parseEvolutionWebhook({ ...upsert, instance: { instanceName: "sinery-x" } }).instanceName).toBe("sinery-x")
  })

  it("aceita data como array com múltiplas mensagens", () => {
    const r = parseEvolutionWebhook({
      event: "MESSAGES_UPSERT",
      instance: "sinery-hml",
      data: [
        { key: { id: "A", remoteJid: "5534999990001@s.whatsapp.net", fromMe: false }, message: { conversation: "um" } },
        { key: { id: "B", remoteJid: "5534999990002@s.whatsapp.net", fromMe: false }, message: { conversation: "dois" } },
      ],
    })
    expect(r.messages).toHaveLength(2)
  })
})

// ---------- Normalizer (Part 15: 16-19) ----------
describe("evolution normalizer", () => {
  const raw = parseEvolutionWebhook({
    event: "messages.upsert",
    instance: "sinery-hml",
    data: { key: { id: "MSG9", remoteJid: "5534991429784@s.whatsapp.net", fromMe: false }, pushName: "Gabriel", message: { conversation: "oi" }, messageTimestamp: 1700000000 },
  }).messages[0]

  it("fromPhone extraído de remoteJid", () => {
    expect(phoneFromRemoteJid("5534991429784@s.whatsapp.net")).toBe("5534991429784")
    expect(normalizeEvolutionMessage(raw, "sinery-hml").fromPhone).toBe("5534991429784")
  })
  it("externalMessageId extraído", () => {
    expect(normalizeEvolutionMessage(raw, "sinery-hml").externalMessageId).toBe("MSG9")
  })
  it("pushName vira contactName", () => {
    expect(normalizeEvolutionMessage(raw, "sinery-hml").contactName).toBe("Gabriel")
  })
  it("texto vazio é tratado como unknown", () => {
    const empty = { keyId: "E", remoteJid: "5534991429784@s.whatsapp.net", fromMe: false, text: "", isGroup: false }
    expect(normalizeEvolutionMessage(empty, "sinery-hml").messageType).toBe("unknown")
  })
})

// ---------- Send client (Part 15: 20-23) ----------
describe("evolution send client (pure)", () => {
  it("mock mode gera mock id no formato mock_evolution_", () => {
    expect(mockEvolutionMessageId()).toMatch(/^mock_evolution_/)
  })
  it("body esperado para sendText (number digits-only, textMessage.text)", () => {
    expect(buildEvolutionSendBody("+55 (34) 99143-2222", "olá")).toEqual({ number: "5534991432222", textMessage: { text: "olá" } })
  })
  it("não força DDI quando já vem com 55", () => {
    expect(buildEvolutionSendBody("5534991432222", "x").number).toBe("5534991432222")
  })
  it("erro sanitizado remove fragmentos de secret e trunca", () => {
    const msg = sanitizeEvolutionError("failed apikey=SUPERSECRET123 while calling")
    expect(msg).not.toContain("SUPERSECRET123")
    expect(msg).toContain("apikey=***")
  })
  it("parseEvolutionSendResponse extrai key.id / detecta erro", () => {
    expect(parseEvolutionSendResponse({ key: { id: "3EB0" }, status: "PENDING" })).toEqual({ ok: true, externalMessageId: "3EB0" })
    expect(parseEvolutionSendResponse({ error: "bad" }).ok).toBe(false)
  })
})

// ---------- Provider routing (Part 15: 24-26) ----------
describe("provider routing", () => {
  it("provider evolution roteia para evolution (local/staging)", () => {
    const r = decideSendProvider({ integrationProvider: "EVOLUTION_API", appEnv: "staging", evolutionAllowedInProduction: false })
    expect(r).toEqual({ ok: true, provider: "EVOLUTION_API" })
  })
  it("provider meta mantém meta", () => {
    const r = decideSendProvider({ integrationProvider: "META_CLOUD_API", appEnv: "production", evolutionAllowedInProduction: false })
    expect(r).toEqual({ ok: true, provider: "META_CLOUD_API" })
  })
  it("provider production evolution bloqueado", () => {
    const r = decideSendProvider({ integrationProvider: "EVOLUTION_API", appEnv: "production", evolutionAllowedInProduction: false })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe("evolution_blocked_in_production")
  })
  it("normalizeMessagingProvider aceita aliases e default seguro", () => {
    expect(normalizeMessagingProvider("evolution")).toBe("EVOLUTION_API")
    expect(normalizeMessagingProvider("meta")).toBe("META_CLOUD_API")
    expect(normalizeMessagingProvider("garbage")).toBe("META_CLOUD_API")
    expect(normalizeMessagingProvider(undefined)).toBe("META_CLOUD_API")
  })
})

// ---------- Idempotency (Part 15: 27-28) ----------
describe("messaging idempotency hash", () => {
  it("mesmo externalMessageId → mesmo hash; diferente → diferente", () => {
    const a = buildMessagingEventHash({ provider: "EVOLUTION_API", instanceName: "sinery-hml", externalMessageId: "MSG1" })
    const b = buildMessagingEventHash({ provider: "EVOLUTION_API", instanceName: "sinery-hml", externalMessageId: "MSG1" })
    const c = buildMessagingEventHash({ provider: "EVOLUTION_API", instanceName: "sinery-hml", externalMessageId: "MSG2" })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
  it("hash não contém segredo (só ids)", () => {
    const h = buildMessagingEventHash({ provider: "EVOLUTION_API", instanceName: "sinery-hml", externalMessageId: "MSG1" })
    expect(h).toMatch(/^[a-f0-9]{64}$/)
  })
})
