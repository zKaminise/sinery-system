/**
 * NON-AUTHORITATIVE estimated cost for AI usage, in cents. This is only for the
 * usage panel — the real bill must be confirmed in the OpenAI dashboard. Prices
 * are cents-per-token, approximate, and easy to tweak here.
 * SOURCE: OpenAI public pricing (approx.), converted from $/1M tokens.
 */
export interface CostInput {
  model: string | null | undefined
  inputTokens?: number | null
  outputTokens?: number | null
}

interface Price {
  input: number // cents per input token
  output: number // cents per output token
}

// $/1M → cents/token: ($ per 1M) * 100 / 1_000_000 = ($ per 1M) / 10_000.
const MODEL_PRICING: { match: string; price: Price }[] = [
  { match: "gpt-4o-mini", price: { input: 0.000015, output: 0.00006 } }, // $0.15 / $0.60
  { match: "gpt-4.1-mini", price: { input: 0.00004, output: 0.00016 } }, // $0.40 / $1.60
  { match: "gpt-4.1-nano", price: { input: 0.00001, output: 0.00004 } }, // $0.10 / $0.40
  { match: "gpt-4o", price: { input: 0.00025, output: 0.001 } }, // $2.50 / $10.00
  { match: "gpt-4.1", price: { input: 0.0002, output: 0.0008 } }, // $2.00 / $8.00
]

/** Longest-prefix match so "gpt-4o-mini-2024" resolves before "gpt-4o". */
function priceFor(model: string): Price | null {
  const normalized = model.trim().toLowerCase()
  let best: { len: number; price: Price } | null = null
  for (const entry of MODEL_PRICING) {
    if (normalized.startsWith(entry.match) && (!best || entry.match.length > best.len)) {
      best = { len: entry.match.length, price: entry.price }
    }
  }
  return best?.price ?? null
}

/**
 * Estimates cost in whole cents. `mock` → 0 (no real spend). Unknown model →
 * null (we don't guess a price). Missing tokens count as 0.
 */
export function estimateAiCostInCents(input: CostInput): number | null {
  const model = (input.model ?? "").trim().toLowerCase()
  if (!model || model === "mock") return 0

  const price = priceFor(model)
  if (!price) return null

  const inTok = input.inputTokens ?? 0
  const outTok = input.outputTokens ?? 0
  return Math.round(inTok * price.input + outTok * price.output)
}
