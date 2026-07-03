import { clinicToday, getDayOfWeekForDate } from "@/lib/appointments/date-utils"
import { normalize } from "@/lib/assist/intent-detector"

export type AssistPeriod = "MORNING" | "AFTERNOON" | "EVENING" | "ANY"

export interface ParsedDate {
  /** Clinic-local "YYYY-MM-DD", or null when no date was understood. */
  date: string | null
  /** Detected time-of-day preference, or null when none was stated. */
  period: AssistPeriod | null
  /** 0..1 rough confidence — higher for explicit expressions. */
  confidence: number
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  "terca-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function detectPeriod(text: string): AssistPeriod | null {
  // Word boundaries matter: "amanha" must NOT be read as "manha" (morning).
  if (/\btarde\b/.test(text)) return "AFTERNOON"
  if (/\bnoite\b/.test(text)) return "EVENING"
  if (/\bmanha\b/.test(text) || /\bmanhazinha\b/.test(text)) return "MORNING"
  return null
}

/** Nearest future date (>= 1 day ahead) whose weekday matches `dow`. */
function nextWeekday(today: string, dow: number, timeZone: string): string {
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(today, i)
    if (getDayOfWeekForDate(candidate, timeZone) === dow) return candidate
  }
  return addDays(today, 1)
}

/**
 * Deterministic Portuguese date-expression parser for patient messages.
 * Understands: hoje / amanhã / depois de amanhã / weekday names /
 * "próxima <weekday>" / "dia N" / dd/mm / dd/mm/yyyy, plus a period
 * (manhã/tarde/noite). Uses the clinic timezone; past-only dates roll to the
 * next occurrence. NOT full NLP — ambiguous phrases return date=null so the
 * caller can ask for clarification. See docs/ai-assist.md for limitations.
 */
export function parsePatientDateExpression(message: string, timeZone: string): ParsedDate {
  const text = normalize(message)
  const today = clinicToday(timeZone)
  const period = detectPeriod(text)

  if (!text) return { date: null, period, confidence: 0 }

  // Explicit relative expressions (highest confidence).
  if (text.includes("depois de amanha")) return { date: addDays(today, 2), period, confidence: 0.95 }
  if (text.includes("amanha")) return { date: addDays(today, 1), period, confidence: 0.95 }
  if (text.includes("hoje")) return { date: today, period, confidence: 0.95 }

  // dd/mm or dd/mm/yyyy.
  const dm = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (dm) {
    const day = Number(dm[1])
    const month = Number(dm[2])
    let year = dm[3] ? Number(dm[3]) : Number(today.split("-")[0])
    if (dm[3] && dm[3].length === 2) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let candidate = `${year}-${pad(month)}-${pad(day)}`
      // No explicit year and date already passed → roll to next year.
      if (!dm[3] && candidate < today) candidate = `${year + 1}-${pad(month)}-${pad(day)}`
      return { date: candidate, period, confidence: 0.9 }
    }
  }

  // "dia N" → day N this month (or next month if already passed).
  const diaN = text.match(/\bdia\s+(\d{1,2})\b/)
  if (diaN) {
    const day = Number(diaN[1])
    if (day >= 1 && day <= 31) {
      const [ty, tm] = today.split("-").map(Number)
      let candidate = `${ty}-${pad(tm)}-${pad(day)}`
      if (candidate < today) {
        const nm = tm === 12 ? 1 : tm + 1
        const ny = tm === 12 ? ty + 1 : ty
        candidate = `${ny}-${pad(nm)}-${pad(day)}`
      }
      return { date: candidate, period, confidence: 0.75 }
    }
  }

  // Weekday names ("sexta", "próxima segunda").
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b${name}\\b`)
    if (re.test(text)) {
      return { date: nextWeekday(today, dow, timeZone), period, confidence: 0.8 }
    }
  }

  // Only a period was stated (e.g. "de manhã") — no date.
  return { date: null, period, confidence: period ? 0.3 : 0 }
}
