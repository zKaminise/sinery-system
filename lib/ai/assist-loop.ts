import "server-only"

import { prisma } from "@/lib/prisma"
import { AuditAction } from "@/lib/audit-actions"
import { evaluateAssistLoop, type LoopResult } from "@/lib/ai/assist-loop-core"

/**
 * Server wrapper for loop detection. Gathers recent AI replies and the count of
 * recent tool failures for this conversation, then defers to the pure
 * evaluator. Stuck re-prompting shows up as repeated identical AI replies.
 */
export async function detectAssistLoop(clinicId: string, conversationId: string): Promise<LoopResult> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)

  const [aiMessages, toolFailures] = await Promise.all([
    prisma.message.findMany({
      where: { clinicId, conversationId, senderType: "AI" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { content: true },
    }),
    prisma.auditLog.count({
      where: {
        clinicId,
        action: AuditAction.ASSIST_TOOL_FAILED,
        entityId: conversationId,
        createdAt: { gte: tenMinAgo },
      },
    }),
  ])

  const recentAiReplies = aiMessages.map((m) => m.content).reverse()
  return evaluateAssistLoop({ recentAiReplies, recentSteps: [], toolFailuresLast10min: toolFailures })
}
