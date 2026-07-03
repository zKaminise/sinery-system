import { Sparkles, Cog, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import type { AssistRuntimeInfo } from "@/lib/assist/queries"

/**
 * Shows whether /assist is running the real AI (OpenAI) or the rule-based
 * simulator, plus API/model status. Never renders the API key value.
 */
interface AssistModeBannerProps {
  runtime: AssistRuntimeInfo
  aiCallsToday: number
  aiTokensToday: number
}

export function AssistModeBanner({ runtime, aiCallsToday, aiTokensToday }: AssistModeBannerProps) {
  const isReal = runtime.mode === "OPENAI"

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-4 py-3",
        isReal ? "border-secondary/30 bg-secondary/5" : "border-warning/20 bg-warning/5"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {isReal ? (
          <Sparkles className="size-4 text-secondary" />
        ) : (
          <Cog className="size-4 text-warning" />
        )}
        Modo atual: {isReal ? "IA real ativa" : "Simulador por regras"}
        {runtime.isMock && isReal && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
            offline (mock)
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {isReal ? (
          <>
            Status da API: configurada · Modelo: <span className="font-medium text-foreground">{runtime.model}</span> ·
            Assist {runtime.assistEnabled ? "ativa" : "inativa"}.
          </>
        ) : (
          <>
            {runtime.hasApiKey
              ? "Chave presente, mas ASSIST_USE_REAL_AI está desativado."
              : "Configure OPENAI_API_KEY e ASSIST_USE_REAL_AI=true para usar IA real."}{" "}
            As respostas seguem regras determinísticas, sem IA real.
          </>
        )}
      </p>
      {isReal && (
        <p className="text-xs text-muted-foreground">
          Uso hoje: {aiCallsToday} {aiCallsToday === 1 ? "chamada" : "chamadas"} · {aiTokensToday} tokens.
        </p>
      )}
      {!runtime.assistEnabled && isReal && (
        <p className="flex items-center gap-1 text-xs text-warning">
          <TriangleAlert className="size-3.5" /> A Assist está desativada para uso real; o simulador continua disponível para testes.
        </p>
      )}
    </div>
  )
}
