/**
 * PURE loop/repetition detection for the Sinery Assist. No DB — the server
 * wrapper (assist-loop.ts) gathers the signals and calls this. Kept pure so it
 * is unit-testable.
 */
export interface LoopSignals {
  /** Most recent AI reply contents, newest last. */
  recentAiReplies: string[]
  /** Most recent flow steps, newest last (may include null/"IDLE"). */
  recentSteps: (string | null)[]
  /** Tool failures for this conversation in the last ~10 minutes. */
  toolFailuresLast10min: number
}

export interface LoopResult {
  loop: boolean
  reason: "repeated_replies" | "stuck_step" | "tool_failures" | null
}

function squash(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)
}

/**
 * Flags a loop when: the last 3 AI replies are essentially identical, OR the
 * same step repeats more than 4 times in a row, OR there are 3+ tool failures
 * in the recent window.
 */
export function evaluateAssistLoop(signals: LoopSignals): LoopResult {
  if (signals.toolFailuresLast10min >= 3) {
    return { loop: true, reason: "tool_failures" }
  }

  const replies = signals.recentAiReplies.filter((r) => r && r.trim().length > 0)
  if (replies.length >= 3) {
    const last3 = replies.slice(-3).map(squash)
    if (last3[0] === last3[1] && last3[1] === last3[2]) {
      return { loop: true, reason: "repeated_replies" }
    }
  }

  // Longest run of an identical, non-idle step.
  let maxRun = 0
  let run = 0
  let prev: string | null = null
  for (const raw of signals.recentSteps) {
    const step = raw && raw !== "IDLE" ? raw : null
    if (step && step === prev) {
      run += 1
    } else {
      run = step ? 1 : 0
    }
    prev = step
    if (run > maxRun) maxRun = run
  }
  if (maxRun > 4) return { loop: true, reason: "stuck_step" }

  return { loop: false, reason: null }
}

export const LOOP_TRANSFER_MESSAGE =
  "Para evitar te prender em um atendimento automático, vou chamar alguém da equipe para continuar por aqui."
