import "server-only"

import { AuditAction } from "@/lib/audit-actions"
import { detectIntent } from "@/lib/assist/intent-detector"
import type { AssistContext } from "@/lib/assist/context"
import type { AssistTurn, AssistIntent } from "@/lib/assist/types"
import { startSchedule, continueSchedule } from "@/lib/assist/flows/schedule-flow"
import { startCancel, continueCancel } from "@/lib/assist/flows/cancel-flow"
import { startReschedule, continueReschedule } from "@/lib/assist/flows/reschedule-flow"
import { handleConfirm } from "@/lib/assist/flows/confirm-flow"
import {
  handleAskAddress,
  handleAskHours,
  handleAskPrice,
  handleHumanHelp,
  handleEmergency,
  handleUnknown,
} from "@/lib/assist/flows/simple-answers"

/** Steps that mean an in-progress flow is awaiting the patient's next reply. */
const ACTIVE_STEPS = new Set([
  "WAITING_SERVICE",
  "WAITING_DATE",
  "WAITING_SLOT_SELECTION",
  "WAITING_APPOINTMENT_SELECTION",
  "CONFIRM_CANCEL",
  "WAITING_NEW_DATE",
])

/**
 * Dispatches a specific (already-decided) intent to its deterministic handler.
 * Exported so the OpenAI provider can ground a no-tool AI intent through the
 * same rule handlers (e.g. ASK_ADDRESS → DB-backed reply, not model free text).
 */
export async function dispatchAssistIntent(ctx: AssistContext, intent: AssistIntent): Promise<AssistTurn> {
  return dispatchFresh(ctx, intent)
}

async function dispatchFresh(ctx: AssistContext, intent: AssistIntent): Promise<AssistTurn> {
  switch (intent) {
    case "SCHEDULE_APPOINTMENT":
      return startSchedule(ctx)
    case "CANCEL_APPOINTMENT":
      return startCancel(ctx)
    case "RESCHEDULE_APPOINTMENT":
      return startReschedule(ctx)
    case "CONFIRM_APPOINTMENT":
      return handleConfirm(ctx)
    case "ASK_ADDRESS":
      return handleAskAddress(ctx)
    case "ASK_HOURS":
      return handleAskHours(ctx)
    case "ASK_PRICE":
      return handleAskPrice(ctx)
    case "HUMAN_HELP":
      return handleHumanHelp(ctx)
    case "EMERGENCY_OR_SENSITIVE":
      return handleEmergency(ctx)
    default:
      return handleUnknown(ctx)
  }
}

/**
 * Core of the deterministic Sinery Assist simulator. Given a loaded context
 * (clinic data + the patient message + current flow state), it either
 * continues an in-progress flow or classifies a fresh intent, then returns the
 * turn's replies/status/flow/audits. Every turn is prefixed with an
 * ASSIST_INTENT_DETECTED audit for the effective intent.
 *
 * This is NOT an LLM — it is pure keyword rules + explicit state machines. It
 * is the seam where a real AI could later replace `dispatchFresh`/flows while
 * keeping the same persistence and agenda-rule integration.
 */
export async function runAssistTurn(ctx: AssistContext): Promise<AssistTurn> {
  const flow = ctx.flow
  const isContinuing = Boolean(flow && ACTIVE_STEPS.has(flow.step))

  // Safety and human-help override any in-progress flow.
  const detected = detectIntent(ctx.text)
  let turn: AssistTurn
  let effectiveIntent: AssistIntent

  if (isContinuing && detected !== "EMERGENCY_OR_SENSITIVE" && detected !== "HUMAN_HELP") {
    effectiveIntent = flow!.intent
    switch (flow!.intent) {
      case "SCHEDULE_APPOINTMENT":
        turn = await continueSchedule(ctx, flow!)
        break
      case "CANCEL_APPOINTMENT":
        turn = await continueCancel(ctx, flow!)
        break
      case "RESCHEDULE_APPOINTMENT":
        turn = await continueReschedule(ctx, flow!)
        break
      default:
        turn = await dispatchFresh(ctx, detected)
        effectiveIntent = detected
    }
  } else {
    effectiveIntent = detected
    turn = await dispatchFresh(ctx, detected)
  }

  // Prefix the intent-detection audit so it's always recorded.
  turn.audits.unshift({
    action: AuditAction.ASSIST_INTENT_DETECTED,
    description: `Intenção detectada pela Sinery Assist: ${effectiveIntent}.`,
    metadata: { conversationId: ctx.conversationId, intent: effectiveIntent, continuing: isContinuing },
  })

  return turn
}
