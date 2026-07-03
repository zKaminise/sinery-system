import { Clock } from "lucide-react"

import type { AssistSlot } from "@/lib/assist/types"

/** Read-only preview of the slots the assistant currently has on offer. */
export function AvailableSlotsList({ slots }: { slots: AssistSlot[] }) {
  if (slots.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Horários sugeridos</span>
      <ul className="flex flex-col gap-1.5">
        {slots.map((slot) => (
          <li
            key={slot.index}
            className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-[11px] font-semibold text-secondary">
              {slot.index}
            </span>
            <Clock className="size-3 text-muted-foreground" />
            <span className="font-medium text-foreground">{slot.startTime}</span>
            <span className="truncate text-muted-foreground">· {slot.professionalName}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
