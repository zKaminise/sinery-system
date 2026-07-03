import { normalize } from "@/lib/assist/intent-detector"

export interface ServiceOption {
  id: string
  name: string
}

export type ServiceMatch =
  | { status: "match"; service: ServiceOption }
  | { status: "ambiguous"; candidates: ServiceOption[] }
  | { status: "none" }

/**
 * Alias keywords keyed by a normalized substring of the canonical service
 * name. If the (normalized) service name CONTAINS the key, its aliases apply.
 * Lets "profilaxia" match "Limpeza", "canal" match "Tratamento de canal", etc.
 */
const ALIASES: { key: string; words: string[] }[] = [
  { key: "avaliacao", words: ["avaliacao", "consulta", "primeira consulta", "avaliar"] },
  { key: "limpeza", words: ["limpeza", "profilaxia", "limpar"] },
  { key: "clareamento", words: ["clareamento", "clarear", "clarear os dentes"] },
  { key: "manutencao", words: ["manutencao", "aparelho", "ortodontia", "ortodontica"] },
  { key: "canal", words: ["canal", "endodontia", "tratamento de canal"] },
]

function aliasWordsFor(normalizedName: string): string[] {
  const words: string[] = []
  for (const alias of ALIASES) {
    if (normalizedName.includes(alias.key)) words.push(...alias.words)
  }
  return words
}

/**
 * Matches a clinic service from a free-text patient message using exact name,
 * partial/word match, and a small alias table (accent-insensitive). Returns a
 * single `match`, `ambiguous` (2+ candidates → ask), or `none`.
 */
export function matchServiceFromMessage(message: string, services: ServiceOption[]): ServiceMatch {
  const text = normalize(message)
  if (!text) return { status: "none" }

  const matched: ServiceOption[] = []

  for (const service of services) {
    const name = normalize(service.name)
    let hit = false

    if (text.includes(name)) {
      hit = true
    } else {
      // Any significant word of the service name appears in the message.
      const words = name.split(/\s+/).filter((w) => w.length >= 4)
      if (words.some((w) => text.includes(w))) hit = true
      // Or any alias keyword.
      if (!hit && aliasWordsFor(name).some((w) => text.includes(w))) hit = true
    }

    if (hit) matched.push({ id: service.id, name: service.name })
  }

  // De-duplicate by id (a service can match on multiple signals).
  const unique = matched.filter((s, i) => matched.findIndex((o) => o.id === s.id) === i)

  if (unique.length === 0) return { status: "none" }
  if (unique.length === 1) return { status: "match", service: unique[0] }
  return { status: "ambiguous", candidates: unique }
}
