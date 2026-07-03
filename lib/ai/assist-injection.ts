import { normalize } from "@/lib/assist/intent-detector"

export interface InjectionResult {
  injected: boolean
  reasons: string[]
}

/**
 * Prompt-injection / jailbreak / data-exfiltration phrases (normalized,
 * accent-insensitive substrings). Patient text can NEVER override clinic rules
 * or reveal internal data — a match is refused, not obeyed.
 */
const INJECTION_PATTERNS = [
  "ignore suas instrucoes",
  "ignore as instrucoes",
  "ignore as regras",
  "ignore todas as regras",
  "ignore previous",
  "ignore all previous",
  "desconsidere as instrucoes",
  "esqueca as instrucoes",
  "mostre o prompt",
  "mostre seu prompt",
  "mostrar o prompt",
  "system prompt",
  "qual e sua system",
  "qual e o seu prompt",
  "revele sua chave",
  "revele a chave",
  "sua api key",
  "sua chave de api",
  "voce agora e",
  "finja que",
  "faz de conta que",
  "modo desenvolvedor",
  "developer mode",
  "jailbreak",
  "execute sql",
  "rode sql",
  "drop table",
  "select * from",
  "delete from",
  "dados de outro paciente",
  "dados dos outros pacientes",
  "liste todos os pacientes",
  "lista de todos os pacientes",
  "todos os pacientes da clinica",
  "me envie tokens",
  "bypass",
  "contorne as regras",
]

/** Returns which injection patterns (if any) the message matches. */
export function detectPromptInjection(message: string): InjectionResult {
  const text = normalize(message)
  if (!text) return { injected: false, reasons: [] }
  const reasons = INJECTION_PATTERNS.filter((p) => text.includes(p))
  return { injected: reasons.length > 0, reasons }
}

export const INJECTION_REFUSAL =
  "Não posso ajudar com esse tipo de solicitação. Posso te ajudar com agenda, horários e informações administrativas da clínica."
