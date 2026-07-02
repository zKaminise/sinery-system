import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { conversationStatusLabels } from "@/lib/conversations/constants"
import type { ConversationStatus } from "@/lib/generated/prisma/client"

const statusStyles: Record<ConversationStatus, string> = {
  AI_HANDLING: "bg-secondary/10 text-secondary",
  WAITING_HUMAN: "bg-warning/10 text-warning",
  HUMAN_HANDLING: "bg-primary/10 text-primary",
  CLOSED: "bg-muted text-muted-foreground",
}

export function ConversationStatusBadge({
  status,
  className,
}: {
  status: ConversationStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", statusStyles[status], className)}>
      {conversationStatusLabels[status]}
    </Badge>
  )
}
