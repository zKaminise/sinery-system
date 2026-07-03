import "server-only"

import { getWhatsAppRuntimeConfig, getWhatsAppSecrets, isLiveCheckAllowed } from "@/lib/whatsapp/whatsapp-config"

const GRAPH_BASE = "https://graph.facebook.com"

/**
 * Builds a Graph API URL for the configured version. NOTE (Prompt 16): this is
 * preparatory — nothing here actually sends a message. Real sending arrives in
 * Prompt 18.
 */
export function buildWhatsAppGraphUrl(path: string): string {
  const version = getWhatsAppRuntimeConfig().graphApiVersion
  const clean = path.replace(/^\/+/, "")
  return `${GRAPH_BASE}/${version}/${clean}`
}

/**
 * SERVER-ONLY. Authorization header for the Graph API. Never call this from a
 * client component — the access token must never reach the browser.
 */
export function getWhatsAppHeaders(): Record<string, string> {
  const { accessToken } = getWhatsAppSecrets()
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }
}

/**
 * Optional read-only Graph check of the phone number config. DISABLED by
 * default (WHATSAPP_ALLOW_CONFIG_LIVE_CHECK=false) so no external call is made
 * during config verification, build, or health. Kept as a documented seam for
 * Prompt 17/18. Returns `{ skipped: true }` unless explicitly enabled.
 */
export async function optionalCheckPhoneNumberConfig(): Promise<
  { skipped: true; reason: string } | { skipped: false; ok: boolean }
> {
  if (!isLiveCheckAllowed()) {
    return { skipped: true, reason: "live_check_disabled" }
  }
  const cfg = getWhatsAppRuntimeConfig()
  if (!cfg.hasAccessToken || !cfg.hasPhoneNumberId) {
    return { skipped: true, reason: "missing_credentials" }
  }
  // Intentionally NOT implemented in Prompt 16 — real Graph calls arrive later.
  // (When enabled: GET buildWhatsAppGraphUrl(phoneNumberId) with headers.)
  return { skipped: true, reason: "not_implemented_prompt_16" }
}
