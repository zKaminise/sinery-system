import "server-only"

/**
 * Resolves the Sinery Assist AI configuration from environment variables.
 * SERVER-ONLY: `apiKey` must never reach the browser. The rest of the app only
 * ever sees `useRealAi`, `hasApiKey`, `model`, etc. — never the key itself.
 */
export interface AiConfig {
  /** Real AI runs only when true AND a key is present. */
  useRealAi: boolean
  hasApiKey: boolean
  /** Offline deterministic stub (no network/cost) for dev/testing. */
  isMock: boolean
  model: string
  timeoutMs: number
  maxOutputTokens: number
  dailyTokenLimit: number
  maxHistoryMessages: number
}

/** Documented safe default model when OPENAI_MODEL is not set. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

function num(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Reads the current AI config. Never returns the raw API key. */
export function getAiConfig(): AiConfig {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim()
  const rawModel = (process.env.OPENAI_MODEL ?? "").trim()
  const useRealAiFlag = (process.env.ASSIST_USE_REAL_AI ?? "").trim().toLowerCase() === "true"
  const hasApiKey = apiKey.length > 0
  // "mock" (in key or model) runs the AI code path offline — no network call.
  const isMock = apiKey.toLowerCase() === "mock" || rawModel.toLowerCase() === "mock"

  return {
    useRealAi: useRealAiFlag && hasApiKey,
    hasApiKey,
    isMock,
    model: rawModel && rawModel.toLowerCase() !== "mock" ? rawModel : DEFAULT_OPENAI_MODEL,
    timeoutMs: num(process.env.OPENAI_TIMEOUT_MS, 20000),
    maxOutputTokens: num(process.env.OPENAI_MAX_OUTPUT_TOKENS, 800),
    dailyTokenLimit: num(process.env.ASSIST_DAILY_TOKEN_LIMIT, 100000),
    maxHistoryMessages: num(process.env.ASSIST_MAX_HISTORY_MESSAGES, 20),
  }
}

/** Never returns the key value — only whether it exists and (masked) suffix. */
export function getAiPublicStatus() {
  const cfg = getAiConfig()
  return {
    mode: cfg.useRealAi ? ("OPENAI" as const) : ("RULE_BASED" as const),
    hasApiKey: cfg.hasApiKey,
    isMock: cfg.isMock,
    model: cfg.useRealAi ? cfg.model : null,
    useRealAiFlag: (process.env.ASSIST_USE_REAL_AI ?? "").trim().toLowerCase() === "true",
  }
}
