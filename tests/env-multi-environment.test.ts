import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { evaluateEnvReadiness, resolveAppEnv, type EnvSnapshot } from "@/lib/env/env-readiness"

const ROOT = process.cwd()
const EXAMPLE_FILES = [".env.local.example", ".env.staging.example", ".env.production.example"]
// Every committed env template (incl. the universal index) must be secret-free.
const COMMITTED_ENV_FILES = [".env.example", ...EXAMPLE_FILES]

// Sensitive keys whose values in a COMMITTED example must always be a
// placeholder — never a real secret. A value is "safe" when empty or when it
// contains one of these placeholder tokens.
const SENSITIVE_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "RESEND_API_KEY",
  "ASAAS_API_KEY",
  "OPENAI_API_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "ASAAS_WEBHOOK_TOKEN",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
]
const PLACEHOLDER_TOKENS = [
  "generate",
  "change-me",
  "xxxx",
  "user:password",
  "localhost",
  "sk-...",
  "meta-production-token",
  "asaas-production-key",
  "local-",
  "fake",
]

function parseEnvExample(file: string): Record<string, string> {
  const text = readFileSync(resolve(ROOT, file), "utf8")
  const out: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

describe("env example files", () => {
  it("all three per-environment example files exist", () => {
    for (const file of EXAMPLE_FILES) {
      expect(existsSync(resolve(ROOT, file)), file).toBe(true)
    }
  })

  it("example files contain no obvious real secrets (only placeholders)", () => {
    // Collect EVERY offender across all files so a mistake shows all leaks at
    // once (instead of failing on the first). Never print the raw value — just
    // the file + variable name — so the test output itself never leaks a secret.
    const offenders: string[] = []
    for (const file of COMMITTED_ENV_FILES) {
      const env = parseEnvExample(file)
      for (const key of SENSITIVE_KEYS) {
        const value = env[key]
        if (value === undefined || value === "") continue
        const lower = value.toLowerCase()
        const isPlaceholder = PLACEHOLDER_TOKENS.some((t) => lower.includes(t))
        if (!isPlaceholder) offenders.push(`${file} → ${key}`)
      }
    }
    expect(offenders, `These committed example vars look like REAL secrets — move them to a *.local file: ${offenders.join(", ")}`).toEqual([])
  })

  it("staging/production examples use the correct APP_ENV + domains", () => {
    const staging = parseEnvExample(".env.staging.example")
    expect(staging.APP_ENV).toBe("staging")
    expect(staging.NEXT_PUBLIC_APP_URL).toContain("hml.app.sinery.com.br")

    const prod = parseEnvExample(".env.production.example")
    expect(prod.APP_ENV).toBe("production")
    expect(prod.NEXT_PUBLIC_APP_URL).toContain("app.sinery.com.br")
    // Production must NOT ship mock modes enabled.
    expect(prod.EMAIL_MOCK_MODE).toBe("false")
    expect(prod.ASAAS_MOCK_MODE).toBe("false")
    expect(prod.WHATSAPP_SEND_MOCK_MODE).toBe("false")

    const local = parseEnvExample(".env.local.example")
    expect(local.APP_ENV).toBe("local")
    expect(local.NODE_ENV).toBe("development")
  })
})

describe("resolveAppEnv — APP_ENV is the source of truth", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("APP_ENV=staging uses staging rules even with NODE_ENV=production", () => {
    vi.stubEnv("SINERY_ENV", "")
    vi.stubEnv("APP_ENV", "staging")
    vi.stubEnv("NODE_ENV", "production")
    expect(resolveAppEnv()).toBe("staging")
  })

  it("APP_ENV=hml (and homolog) resolves to staging", () => {
    vi.stubEnv("SINERY_ENV", "")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_ENV", "hml")
    expect(resolveAppEnv()).toBe("staging")
    vi.stubEnv("APP_ENV", "homolog")
    expect(resolveAppEnv()).toBe("staging")
  })

  it("APP_ENV=production resolves to production", () => {
    vi.stubEnv("SINERY_ENV", "")
    vi.stubEnv("APP_ENV", "production")
    vi.stubEnv("NODE_ENV", "production")
    expect(resolveAppEnv()).toBe("production")
  })

  it("APP_ENV=local stays local even when NODE_ENV=production (Vercel build)", () => {
    vi.stubEnv("SINERY_ENV", "")
    vi.stubEnv("APP_ENV", "local")
    vi.stubEnv("NODE_ENV", "production")
    expect(resolveAppEnv()).toBe("local")
  })

  it("APP_ENV=development resolves to local", () => {
    vi.stubEnv("SINERY_ENV", "")
    vi.stubEnv("APP_ENV", "development")
    vi.stubEnv("NODE_ENV", "production")
    expect(resolveAppEnv()).toBe("local")
  })

  it("SINERY_ENV takes precedence over APP_ENV", () => {
    vi.stubEnv("SINERY_ENV", "production")
    vi.stubEnv("APP_ENV", "local")
    expect(resolveAppEnv()).toBe("production")
  })
})

const STRONG = "kJ8f2p9Qx7Lm3Vw6Rt1Zc4Yb0Nh5Dg8Ae2Uf7Ss="

function snapshot(overrides: Partial<EnvSnapshot> = {}): EnvSnapshot {
  return {
    appEnv: "local",
    hasDatabaseUrl: true,
    authSecret: STRONG,
    hasAppUrl: true,
    emailMockMode: true,
    hasResendKey: false,
    hasResendFrom: true,
    asaasEnabled: false,
    asaasMockMode: true,
    hasAsaasKey: false,
    hasAsaasWebhookToken: false,
    whatsappSendEnabled: false,
    whatsappSendMockMode: false,
    whatsappVerifySignature: true,
    hasWhatsappToken: false,
    hasWhatsappAppSecret: false,
    assistUseRealAi: false,
    hasOpenAiKey: false,
    hasSentryDsn: true,
    ...overrides,
  }
}

describe("readiness — mocks allowed locally/staging, blocked in production", () => {
  it("local/staging: mock modes do NOT block staging readiness", () => {
    const r = evaluateEnvReadiness(snapshot({ appEnv: "local", emailMockMode: true }))
    expect(r.readyForStaging).toBe(true)
    // Production is never ready with mocks on.
    expect(r.readyForProduction).toBe(false)
  })

  it("production: mock modes are critical issues that block production", () => {
    const r = evaluateEnvReadiness(
      snapshot({
        appEnv: "production",
        emailMockMode: true,
        asaasEnabled: true,
        asaasMockMode: true,
        whatsappSendEnabled: true,
        whatsappSendMockMode: true,
      })
    )
    expect(r.readyForProduction).toBe(false)
    const joined = r.criticalIssues.join(" ")
    expect(joined).toContain("EMAIL_MOCK_MODE")
    expect(joined).toContain("ASAAS_MOCK_MODE")
    expect(joined).toContain("WHATSAPP_SEND_MOCK_MODE")
  })

  it("readiness output exposes only NAMES/booleans, never values", () => {
    const r = evaluateEnvReadiness(snapshot({ authSecret: STRONG, hasDatabaseUrl: false }))
    const serialized = JSON.stringify(r)
    expect(serialized).not.toContain(STRONG)
    // missingRequired holds env-var NAMES only (UPPER_SNAKE_CASE).
    for (const name of r.missingRequired) {
      expect(name, name).toMatch(/^[A-Z0-9_]+$/)
    }
  })
})
