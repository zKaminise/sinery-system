import { normalize } from "@/lib/assist/intent-detector"
import { detectSensitiveOrEmergency } from "@/lib/ai/assist-guardrails"

export type AssistRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface AssistRisk {
  level: AssistRiskLevel
  reasons: string[]
}

// CRITICAL — immediate danger / emergency / self-harm / threats. Never automate.
const CRITICAL_TERMS = [
  "emergenc",
  "socorro",
  "urgenc",
  "urgente",
  "suicid",
  "me matar",
  "tirar minha vida",
  "nao quero mais viver",
  "nao quero viver",
  "me machucar",
  "autoagress",
  "desmai",
  "engasg",
  "anafilax",
  "parada cardiaca",
  "convuls",
  "nao consigo respirar",
  "sem ar",
  "ameaca",
]

// MEDIUM — operational-sensitive: complaints, billing, insurance, disputes.
const MEDIUM_TERMS = [
  "convenio",
  "reembolso",
  "reclama",
  "cobranca",
  "cobrar",
  "processo",
  "advogado",
  "procon",
  "absurdo",
  "pessimo",
  "horrivel",
  "insatisfeit",
  "cancelar plano",
  "nota fiscal",
  "boleto",
  "estorno",
]

function matches(text: string, terms: string[]): string[] {
  return terms.filter((t) => text.includes(t))
}

/**
 * Deterministic risk classifier run BEFORE any model call. CRITICAL/HIGH must
 * escalate to a human (no diagnosis, no medication). Operational-sensitive
 * MEDIUM (insurance/billing/complaints) is also escalated by the provider.
 * Precedence: CRITICAL > HIGH > MEDIUM > LOW.
 */
export function classifyAssistMessageRisk(message: string): AssistRisk {
  const text = normalize(message)
  if (!text) return { level: "LOW", reasons: [] }

  const critical = matches(text, CRITICAL_TERMS)
  if (critical.length > 0) return { level: "CRITICAL", reasons: critical }

  // HIGH reuses the clinical/emergency safety net (dor, sangramento, remédio…).
  if (detectSensitiveOrEmergency(message)) {
    return { level: "HIGH", reasons: ["clinical_or_sensitive"] }
  }

  const medium = matches(text, MEDIUM_TERMS)
  if (medium.length > 0) return { level: "MEDIUM", reasons: medium }

  return { level: "LOW", reasons: [] }
}

/** MEDIUM risk categories that should still be routed to a human. */
export function isOperationalSensitive(risk: AssistRisk): boolean {
  return risk.level === "MEDIUM" && risk.reasons.length > 0
}
