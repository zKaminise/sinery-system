import { clinicToday, getDayOfWeekForDate } from "@/lib/appointments/date-utils"
import type { AssistIntent } from "@/lib/assist/types"

/** Lowercases and strips accents so keyword matching is accent-insensitive. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k))
}

// Keyword sets per intent. Order of evaluation in `detectIntent` matters —
// safety-sensitive and more specific intents are checked first (e.g.
// RESCHEDULE before SCHEDULE, since "remarcar" contains "marcar").
const EMERGENCY = ["dor", "doi", "doendo", "sangr", "quebr", "inchad", "remedio", "urgenc", "urgente", "emergenc", "socorro"]
const HUMAN = ["atendente", "falar com uma pessoa", "falar com alguem", "falar com um humano", "humano", "pessoa de verdade", "atendimento humano"]
const PRICE = ["quanto custa", "qual valor", "qual o valor", "preco", "quanto e", "quanto fica", "valores", "tabela de preco"]
const ADDRESS = ["endereco", "onde fica", "onde e", "onde voces", "localizacao", "como chegar", "fica onde", "qual o local", "manda a localizacao"]
const HOURS = ["horario de funcionamento", "horario de atendimento", "que horas abre", "que horas fecha", "abre que horas", "atendem sabado", "atende sabado", "atendem domingo", "funcionam"]
const SERVICES = ["quais servicos", "que servicos", "quais os servicos", "servicos voces", "servicos que voces", "o que voces fazem", "o que voces realizam", "quais procedimentos", "que procedimentos", "quais tratamentos", "que tratamentos", "lista de servicos", "quais sao os servicos", "quais atendimentos", "voces fazem o que"]
const CONFIRM = ["confirmar", "confirmo", "confirma minha", "confirma meu", "vou sim", "estarei", "comparecerei", "compareco", "pode confirmar"]
const RESCHEDULE = ["remarcar", "remarca", "mudar meu horario", "mudar o horario", "trocar minha consulta", "trocar meu horario", "trocar a consulta", "nao posso ir hoje", "adiar", "outro dia", "mudar minha consulta"]
const CANCEL = ["cancelar", "cancela", "desmarcar", "desmarca", "nao vou conseguir ir", "nao vou poder ir", "nao poderei ir"]
const SCHEDULE = ["marcar", "agendar", "agenda", "quero uma consulta", "preciso de uma consulta", "preciso de uma avaliacao", "tem horario", "tem vaga", "reservar", "queria marcar", "gostaria de agendar"]

/**
 * Deterministic, rules-based intent classifier. NOT an LLM — pure keyword
 * matching over normalized text. Returns the best single intent, or UNKNOWN.
 */
export function detectIntent(rawText: string): AssistIntent {
  const text = normalize(rawText)
  if (!text) return "UNKNOWN"

  if (containsAny(text, EMERGENCY)) return "EMERGENCY_OR_SENSITIVE"
  if (containsAny(text, HUMAN)) return "HUMAN_HELP"
  if (containsAny(text, PRICE)) return "ASK_PRICE"
  if (containsAny(text, ADDRESS)) return "ASK_ADDRESS"
  if (containsAny(text, HOURS)) return "ASK_HOURS"
  // Service listing must be checked before SCHEDULE ("marcar") so that
  // "quais serviços vocês fazem?" lists services instead of starting a booking.
  if (containsAny(text, SERVICES)) return "ASK_SERVICES"
  if (containsAny(text, CONFIRM)) return "CONFIRM_APPOINTMENT"
  if (containsAny(text, RESCHEDULE)) return "RESCHEDULE_APPOINTMENT"
  if (containsAny(text, CANCEL)) return "CANCEL_APPOINTMENT"
  if (containsAny(text, SCHEDULE)) return "SCHEDULE_APPOINTMENT"

  return "UNKNOWN"
}

/**
 * Tries to match a clinic service by fuzzy name/keyword. Returns the first
 * service whose name (or a known keyword for it) appears in the message.
 */
export function extractService(
  rawText: string,
  services: { id: string; name: string }[]
): { id: string; name: string } | null {
  const text = normalize(rawText)
  for (const service of services) {
    const name = normalize(service.name)
    // Match on full name or on any significant word of the service name.
    if (text.includes(name)) return service
    const words = name.split(/\s+/).filter((w) => w.length >= 4)
    if (words.some((w) => text.includes(w))) return service
  }
  return null
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

/**
 * Extracts a target date ("YYYY-MM-DD", clinic-local) from natural phrases:
 * hoje / amanhã / depois de amanhã / weekday name / dd/mm. Returns null if none.
 */
export function extractDate(rawText: string, timeZone: string): string | null {
  const text = normalize(rawText)
  const today = clinicToday(timeZone)

  if (text.includes("depois de amanha")) return addDaysToDateStr(today, 2)
  if (text.includes("amanha")) return addDaysToDateStr(today, 1)
  if (text.includes("hoje")) return today

  // dd/mm or dd-mm (current year).
  const dm = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/)
  if (dm) {
    const day = Number(dm[1])
    const month = Number(dm[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = Number(today.split("-")[0])
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }

  // Weekday name → nearest occurrence today..+7.
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (text.includes(name)) {
      for (let i = 0; i <= 7; i++) {
        const candidate = addDaysToDateStr(today, i)
        if (getDayOfWeekForDate(candidate, timeZone) === dow) return candidate
      }
    }
  }

  return null
}

/**
 * True when a "YYYY-MM-DD" date is strictly before today (clinic-local). Used to
 * ask the patient for confirmation instead of searching slots for a past date.
 * Lexicographic comparison is valid for the zero-padded ISO date format.
 */
export function isPastDate(dateStr: string, timeZone: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  return dateStr < clinicToday(timeZone)
}

const ORDINALS: Record<string, number> = {
  primeira: 1,
  primeiro: 1,
  segunda: 2,
  segundo: 2,
  terceira: 3,
  terceiro: 3,
}

/** Parses a menu selection ("1", "opção 2", "a primeira") to a 1-based index. */
export function parseSelection(rawText: string): number | null {
  const text = normalize(rawText)
  const num = text.match(/\b(\d{1,2})\b/)
  if (num) {
    const n = Number(num[1])
    if (n >= 1 && n <= 20) return n
  }
  for (const [word, n] of Object.entries(ORDINALS)) {
    if (text.includes(word)) return n
  }
  return null
}

/** Parses a yes/no answer. Returns "yes", "no", or null when unclear. */
export function parseYesNo(rawText: string): "yes" | "no" | null {
  const text = normalize(rawText)
  if (containsAny(text, ["nao", "cancela nao", "melhor nao", "deixa", "negativo"])) return "no"
  if (containsAny(text, ["sim", "quero", "pode", "isso", "confirmo", "com certeza", "positivo", "claro"])) return "yes"
  return null
}
