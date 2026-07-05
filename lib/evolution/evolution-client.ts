/**
 * Evolution API client surface (Prompt 24). Re-exports the send client so
 * callers can import `evolution-client`. The transport itself + pure helpers
 * live in evolution-send-client.ts (env-free, so the pure parts are testable).
 */
export {
  sendEvolutionTextMessage,
  buildEvolutionSendBody,
  mockEvolutionMessageId,
  parseEvolutionSendResponse,
  type EvolutionSendBody,
  type SendEvolutionParams,
} from "@/lib/evolution/evolution-send-client"
