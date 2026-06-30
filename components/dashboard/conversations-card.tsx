import { MessagesSquare } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { recentConversations, type ConversationStatus } from "@/lib/mock-data"

const statusStyles: Record<ConversationStatus, string> = {
  "IA atendendo": "bg-secondary/10 text-secondary",
  "Aguardando humano": "bg-warning/10 text-warning",
  Finalizado: "bg-success/10 text-success",
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export function ConversationsCard() {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <MessagesSquare className="size-4.5 text-primary" />
        <CardTitle>Conversas recentes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {recentConversations.map((item) => (
          <div
            key={item.patient}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback>{initials(item.patient)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.patient}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.lastMessage}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("shrink-0 border-transparent", statusStyles[item.status])}
            >
              {item.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
