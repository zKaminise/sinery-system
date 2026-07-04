import { cn } from "@/lib/utils"
import { toneClasses, type BadgeTone } from "@/lib/platform/founder-labels"

export function FounderBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses(tone)
      )}
    >
      {label}
    </span>
  )
}
