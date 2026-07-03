import { describe, it, expect } from "vitest"

import { parsePatientDateExpression } from "@/lib/assist/date-parser"
import { clinicToday, getDayOfWeekForDate } from "@/lib/appointments/date-utils"

const TZ = "America/Sao_Paulo"
const today = clinicToday(TZ)

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

describe("parsePatientDateExpression", () => {
  it("understands 'hoje'", () => {
    expect(parsePatientDateExpression("pode ser hoje", TZ).date).toBe(today)
  })

  it("understands 'amanhã'", () => {
    expect(parsePatientDateExpression("quero amanhã", TZ).date).toBe(addDays(today, 1))
  })

  it("understands 'depois de amanhã'", () => {
    expect(parsePatientDateExpression("depois de amanhã", TZ).date).toBe(addDays(today, 2))
  })

  it("understands weekday names as the next future occurrence", () => {
    const result = parsePatientDateExpression("pode ser sexta", TZ)
    expect(result.date).not.toBeNull()
    expect(getDayOfWeekForDate(result.date!, TZ)).toBe(5) // Friday
    expect(result.date! > today).toBe(true)
  })

  it("understands 'próxima segunda'", () => {
    const result = parsePatientDateExpression("próxima segunda", TZ)
    expect(getDayOfWeekForDate(result.date!, TZ)).toBe(1)
  })

  it("understands dd/mm", () => {
    const result = parsePatientDateExpression("dia 10/12", TZ)
    expect(result.date).toMatch(/-12-10$/)
  })

  it("detects period 'à tarde'", () => {
    expect(parsePatientDateExpression("amanhã à tarde", TZ).period).toBe("AFTERNOON")
  })

  it("detects period 'de manhã'", () => {
    expect(parsePatientDateExpression("segunda de manhã", TZ).period).toBe("MORNING")
  })

  it("returns null date for ambiguous text", () => {
    const result = parsePatientDateExpression("sei lá, qualquer coisa", TZ)
    expect(result.date).toBeNull()
    expect(result.confidence).toBe(0)
  })
})
