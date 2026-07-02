import { z } from "zod"

export const daysOfWeek = [0, 1, 2, 3, 4, 5, 6] as const

/** JS Date#getDay() convention: 0 = Sunday ... 6 = Saturday. */
export const dayOfWeekLabels: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const workingHourFormSchema = z
  .object({
    dayOfWeek: z
      .number({ error: "Selecione o dia da semana." })
      .int()
      .min(0, { error: "Dia da semana inválido." })
      .max(6, { error: "Dia da semana inválido." }),
    startTime: z
      .string({ error: "Informe o horário de início." })
      .regex(TIME_PATTERN, { error: "Horário inválido. Use o formato HH:mm." }),
    endTime: z
      .string({ error: "Informe o horário de término." })
      .regex(TIME_PATTERN, { error: "Horário inválido. Use o formato HH:mm." }),
    active: z.boolean(),
  })
  .refine((data) => data.startTime < data.endTime, {
    error: "O horário de início deve ser menor que o horário de término.",
    path: ["endTime"],
  })
export type WorkingHourFormInput = z.infer<typeof workingHourFormSchema>

export interface WorkingHourInterval {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  active: boolean
}

/**
 * Finds an existing active working-hour block that overlaps the candidate,
 * on the same day. Only ACTIVE blocks are considered — an inactive block
 * doesn't block new hours from being created over the same slot. "HH:mm"
 * strings compare correctly with plain string comparison since they're
 * always zero-padded 24h values.
 */
export function findOverlappingWorkingHour(
  candidate: Pick<WorkingHourInterval, "dayOfWeek" | "startTime" | "endTime">,
  existing: WorkingHourInterval[],
  excludeId?: string
): WorkingHourInterval | undefined {
  return existing.find((wh) => {
    if (!wh.active) return false
    if (wh.dayOfWeek !== candidate.dayOfWeek) return false
    if (excludeId && wh.id === excludeId) return false
    return candidate.startTime < wh.endTime && candidate.endTime > wh.startTime
  })
}
