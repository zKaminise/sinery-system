import { normalize } from "@/lib/assist/intent-detector"

/**
 * Clinical/emergency safety net. Runs BEFORE any model call so a sensitive
 * message is never sent to the AI and never gets a diagnosis/medication reply
 * — it is always escalated to a human. Keyword-based over normalized text.
 */
const SENSITIVE_TERMS = [
  "dor",
  "doi",
  "doendo",
  "sangr", // sangramento, sangrando
  "quebr", // quebrei, quebrou o dente
  "trauma",
  "bati a boca",
  "bati o dente",
  "remedio",
  "medicamento",
  "antibiotic",
  "tomar o que",
  "posso tomar",
  "que remedio",
  "alergi",
  "diagnostic",
  "pus",
  "febre",
  "inchad", // inchado, inchaço
  "inchaco",
  "rosto inchado",
  "gravida",
  "gestante",
  "crianca com dor",
  "urgenc",
  "urgente",
  "emergenc",
  "socorro",
  "anestesi",
]

export const SAFE_SENSITIVE_REPLY =
  "Sinto muito por isso. Para sua segurança, vou chamar alguém da equipe para te orientar corretamente. Se for uma emergência, procure atendimento imediatamente."

/** True when the message looks clinical/urgent/sensitive and must escalate. */
export function detectSensitiveOrEmergency(message: string): boolean {
  const text = normalize(message)
  if (!text) return false
  return SENSITIVE_TERMS.some((term) => text.includes(term))
}
