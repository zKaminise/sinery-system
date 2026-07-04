import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * Sinery brand assets (real logo + icon supplied by the client).
 * `unoptimized` serves the files straight from /public/brand — no Next image
 * optimizer round-trip (mirrors the login showcase) so it works the same in
 * dev/Turbopack and in production without extra config.
 */

/** Full "Sinery" wordmark lockup (icon + text). Used in the sidebar (expanded) and login. */
export function SineryWordmark({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src="/brand/sinery-logo.png"
      alt="Sinery"
      width={300}
      height={130}
      priority={priority}
      unoptimized
      className={cn("h-8 w-auto object-contain", className)}
    />
  )
}

/** Standalone "S" icon. Used in the collapsed sidebar. */
export function SineryIcon({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src="/brand/sinery-icon.svg"
      alt="Sinery"
      width={40}
      height={40}
      priority={priority}
      unoptimized
      className={cn("size-9 object-contain", className)}
    />
  )
}
