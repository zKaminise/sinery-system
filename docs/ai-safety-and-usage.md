# Sinery Assist — Segurança, custo e uso (Prompt 15)

Camada de segurança/observabilidade/controle de custo aplicada **antes** de
conectar o WhatsApp real. Nada aqui faz chamada externa por padrão.

## 1. Painel de uso da IA (`/assist/uso`)

Rota dedicada, restrita a **OWNER/ADMIN** (`canViewAiUsage`, validada no
servidor; RECEPTIONIST/PROFESSIONAL recebem "Acesso negado" + `ACCESS_DENIED`).
Mostra:

- **Cards**: chamadas hoje, tokens hoje, custo estimado hoje, com sucesso, com
  erro, transferências para humano, ferramentas hoje, mensagens sensíveis hoje.
- **Tabela** de `AiUsageLog` com data/hora, provider, modo, modelo, conversa,
  resultado, tokens (in/out/total), custo estimado, erro e tempo (latência).
- **Filtros**: data inicial/final, provider, resultado (sucesso/erro),
  conversationId, errorCode. **Paginação** de 20 por página.
- Acessar o painel registra `ASSIST_USAGE_VIEWED`.

Na página `/assist` há também o card **"Segurança e uso"** (visível a todos os
papéis que veem `/assist`, mas custo só aparece para OWNER/ADMIN): badges de
estado, modo efetivo, chave configurada?, modelo, uso hoje, limite diário,
chamadas no último minuto, kill switches, últimas falhas e últimos eventos de
risco, além do link para `/assist/uso` e para a auditoria filtrada.

## 2. AiUsageLog

Campos: `clinicId`, `conversationId?`, `provider`, `mode?`, `model?`,
`inputTokens?`, `outputTokens?`, `totalTokens?`, `estimatedCostInCents?`,
`success`, `errorCode?`, `errorMessage?` (sanitizada), `latencyMs?`,
`toolName?`, `createdAt`. Índices por `(clinicId, createdAt)`,
`(clinicId, success)`, `(clinicId, provider)`.

**Nunca** grava: API key, prompt completo, payload bruto da OpenAI, conteúdo
completo da mensagem. `errorMessage` é truncada (300 chars) e tem chaves
`sk-...`/`Bearer ...` redigidas.

## 3. Custo estimado (`estimateAiCostInCents`)

Tabela interna de preços por modelo (cents/token), casada por prefixo mais
longo (`gpt-4o-mini-2024...` → `gpt-4o-mini`). `mock` → 0; modelo desconhecido
→ `null` (não chutamos). **É aproximado** — a UI avisa "Custo estimado. O valor
real deve ser conferido no painel da OpenAI." Ajuste os preços em
`lib/ai/assist-cost.ts`.

## 4. Rate limits (por banco, sem Redis)

Contados a partir de `AiUsageLog` (todo turno — regra ou IA — gera 1 linha).

| Env | Default | O quê |
|---|---|---|
| `ASSIST_RATE_LIMIT_PER_MINUTE` | 20 | chamadas/clínica/minuto |
| `ASSIST_RATE_LIMIT_PER_DAY` | 1000 | chamadas/clínica/dia |
| `ASSIST_CONVERSATION_RATE_LIMIT_PER_MINUTE` | 10 | mensagens/conversa/minuto |
| `ASSIST_TOOL_RATE_LIMIT_PER_MINUTE` | 30 | tools/conversa/minuto |

Limite excedido: **não chama a OpenAI**, transfere para humano, registra
`ASSIST_RATE_LIMIT_EXCEEDED` (ou `ASSIST_DAILY_LIMIT_EXCEEDED` no limite
diário) e grava `AiUsageLog` com `errorCode=RATE_LIMIT_EXCEEDED`. Limite `<= 0`
= ilimitado. A decisão pura vive em `lib/ai/assist-rate-limit-core.ts`.

## 5. Kill switches

- **Global** (`ASSIST_GLOBAL_DISABLED=true`): bloqueia TODA automação (regras +
  IA), transfere para humano, `ASSIST_GLOBAL_DISABLED`. UI mostra estado
  desativado.
- **Por clínica** (`AiSettings.enabled=false`): bloqueia automação da clínica,
  transfere, `ASSIST_CLINIC_DISABLED`.
- **Limite diário de tokens** (`ASSIST_DAILY_TOKEN_LIMIT`): ao exceder, cai para
  o simulador por regras e registra `ASSIST_DAILY_LIMIT_EXCEEDED`.
- **Tools por turno** (`ASSIST_MAX_TOOLS_PER_TURN=3`): guarda contra loops de
  ferramentas (a IA solicita 1 tool por turno).

## 6. Detecção de loop (`detectAssistLoop` / `evaluateAssistLoop`)

Transfere para humano quando: as últimas 3 respostas da IA são praticamente
idênticas (re-prompt preso), um passo se repete > 4 vezes, OU há 3+ falhas de
tool nos últimos 10 min. Registra `ASSIST_LOOP_DETECTED`. Núcleo puro em
`lib/ai/assist-loop-core.ts`.

## 7. Classificação de risco (`classifyAssistMessageRisk`)

`LOW | MEDIUM | HIGH | CRITICAL` (precedência CRITICAL > HIGH > MEDIUM > LOW):

- **CRITICAL**: emergência, socorro, urgência, autoagressão, ameaça, engasgo,
  falta de ar → transfere, `ASSIST_CRITICAL_RISK_MESSAGE_DETECTED`.
- **HIGH**: sintoma clínico (dor, sangramento, remédio, criança com dor,
  gestante, alergia…) → transfere, `ASSIST_HIGH_RISK_MESSAGE_DETECTED`.
- **MEDIUM** operacional (convênio, reembolso, reclamação, cobrança, processo)
  → transfere para humano.
- **LOW**: segue o fluxo normal.

Nunca diagnostica nem indica medicamento.

## 8. Prompt injection (`detectPromptInjection`)

Detecta "ignore suas instruções", "mostre o system prompt", "execute SQL",
"liste todos os pacientes", "dados de outro paciente", "modo desenvolvedor",
"jailbreak", "bypass" etc. Não obedece; responde apenas que pode ajudar com
agenda/horários/administrativo; registra `ASSIST_PROMPT_INJECTION_DETECTED`. O
system prompt foi reforçado: instruções da clínica têm prioridade absoluta,
nunca revelar prompt/segredos, nunca listar dados internos, nunca SQL, nunca
dados de outra conversa/clínica/paciente.

## 9. Hardening das tools (`executeAssistTool`)

Antes de executar: bloqueia se global disabled, se a clínica está desabilitada,
se a tool é desconhecida (fora do allow-list `ASSIST_TOOLS`), ou se a conversa
está `CLOSED` → `ASSIST_TOOL_BLOCKED` + transferência. Mantém: Zod nos
argumentos, gate de capacidade (`AiSettings.canSchedule/…`), sempre o paciente
da própria conversa, tenant-scope por `clinicId`, e re-validação de
disponibilidade da agenda em ações sensíveis (agendar/remarcar).

## 10. Health check da IA

`/api/health/deep` e `/status` mostram config segura da IA (modo efetivo,
chave configurada?, mock?, kill switch global, modelo, flag de IA real) — **sem
chamada externa** e **sem expor a chave**.

## 11. Como investigar falhas da IA

1. `/assist` → card "Segurança e uso" → "Últimas falhas da IA".
2. `/assist/uso` → filtre `Resultado = Erro` (ou por `errorCode`).
3. `/auditoria` → ações `ASSIST_*` (provider failed, rate limit, risco, injection).

## 12. Como testar

- **Sem key**: `OPENAI_API_KEY=""`, `ASSIST_USE_REAL_AI="false"` → simulador.
- **Mock**: `OPENAI_API_KEY="mock"`, `OPENAI_MODEL="mock"`,
  `ASSIST_USE_REAL_AI="true"` → caminho da IA offline, custo 0.
- **Key real**: `OPENAI_API_KEY="sk-..."`, `OPENAI_MODEL="gpt-4o-mini"`,
  `ASSIST_USE_REAL_AI="true"`.
- **Kill switch**: `ASSIST_GLOBAL_DISABLED="true"` → tudo transfere.
- **Rate limit**: `ASSIST_RATE_LIMIT_PER_MINUTE="1"` e envie 2 mensagens.
- **Testes unitários**: `npm run test` (risk, injection, custo, loop, rate limit).

## 13. Ainda NÃO implementado

WhatsApp real, webhook real, envio externo, pagamento, Google Calendar, Redis
rate limiting, billing real, alertas por e-mail/Slack, painel financeiro real,
observabilidade externa avançada, evals automatizados de IA, fila de revisão
humana, moderação externa avançada, embeddings, realtime/streaming.
