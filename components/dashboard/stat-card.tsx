import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  accent?: "primary" | "secondary" | "success" | "warning"
}

const accentStyles: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            accentStyles[accent]
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}
