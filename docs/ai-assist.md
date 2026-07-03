# Sinery Assist — IA real (OpenAI)

Implementado no Prompt 13. Adiciona um provedor de IA real (OpenAI) à Sinery
Assist, com ferramentas controladas, guardrails de segurança, saída
estruturada validada, controle de custo e **fallback automático** para o
simulador por regras do Prompt 12.

## 1. O que foi implementado

- Camada de provider (`lib/ai/assist-provider.ts`) que decide entre
  **RULE_BASED** (simulador por regras) e **OPENAI** (IA real).
- Cliente OpenAI (`lib/ai/openai-client.ts`) com um **mock offline** para
  testes sem rede/custo.
- Prompt de sistema seguro + contexto por clínica e por conversa.
- Saída estruturada em JSON validada com Zod.
- 10 ferramentas controladas executadas pelo backend (nunca pela IA direto).
- Guardrails contra diagnóstico/medicação e mensagens sensíveis.
- Controle de custo: `AiUsageLog` + limite diário de tokens + métricas.
- Audit logs específicos da IA e logs técnicos sem segredos.
- UI em `/assist` indicando o modo (Simulador × IA real), status da API,
  modelo, intenção/confiança/ferramenta por conversa.

## 2. Simulador por regras × IA real

| | Simulador (Prompt 12) | IA real (Prompt 13) |
| --- | --- | --- |
| Classificação | palavras-chave | modelo OpenAI |
| Ativação | sempre disponível | `ASSIST_USE_REAL_AI=true` + `OPENAI_API_KEY` |
| Ferramentas | fluxos internos | tools via structured output |
| Fallback | — | volta ao simulador em falha/limite |

A **continuação** de um fluxo já iniciado (escolher "1", responder "sim") é
sempre determinística — a IA só é usada para **iniciar** intenções novas. Isso
reduz custo e risco ("não deixar a IA inventar o fluxo inteiro").

## 3. Configuração do .env

```
OPENAI_API_KEY=""            # sua chave; vazio = simulador por regras
OPENAI_MODEL=""              # ex.: gpt-4o-mini (default se vazio)
OPENAI_TIMEOUT_MS="20000"
OPENAI_MAX_OUTPUT_TOKENS="800"
ASSIST_USE_REAL_AI="false"   # true + key = IA real
ASSIST_DAILY_TOKEN_LIMIT="100000"
ASSIST_MAX_HISTORY_MESSAGES="20"
```

- **OPENAI_API_KEY** — nunca exposta ao browser nem gravada em logs/auditoria.
- **OPENAI_MODEL** — configurável; default seguro documentado: `gpt-4o-mini`.
- **ASSIST_USE_REAL_AI=false** — usa o simulador mesmo com chave presente.
- **Modo mock offline** — defina `OPENAI_API_KEY="mock"` (e
  `ASSIST_USE_REAL_AI="true"`) para exercitar todo o caminho de IA real sem
  rede nem custo (a saída é gerada por um stub determinístico).

## 4. Ferramentas (tools)

Solicitadas pela IA (campo `requestedTool`), **executadas e validadas pelo
backend** (`lib/ai/assist-tool-executor.ts`). Toda tool valida `clinicId`,
usa sempre o paciente da conversa (o `patientId` do modelo é ignorado) e
audita mutações.

1. `getClinicInfo` — nome/endereço/horário.
2. `listActiveServices` — serviços ativos.
3. `findAvailableSlots` — horários (regras reais da agenda).
4. `createAppointment` — cria consulta (`createdBySource=AI`). Requer `canSchedule`.
5. `findPatientUpcomingAppointments` — próximas consultas do paciente.
6. `cancelAppointment` — cancela. Requer `canCancel`.
7. `confirmAppointment` — confirma.
8. `rescheduleAppointment` — remarca. Requer `canReschedule`.
9. `transferToHuman` — status → WAITING_HUMAN.
10. `answerFromKnowledgeBase` — busca simples (contains) na base; sem embeddings.

Ferramenta desconhecida é bloqueada; argumentos inválidos → falha segura +
transferência para humano (`ASSIST_TOOL_FAILED`).

## 5. Segurança (guardrails)

- **Mensagens sensíveis/clínicas** (`lib/ai/assist-guardrails.ts`): detectadas
  ANTES de qualquer chamada ao modelo. A mensagem **não é enviada à IA**;
  responde com mensagem segura e transfere para humano
  (`ASSIST_SENSITIVE_MESSAGE_DETECTED`). Nunca há diagnóstico ou indicação de
  medicamento.
- **Prompt de sistema** proíbe diagnóstico, medicação, inventar preço/horário,
  e exige transferência quando incerto. A IA nunca diz que é IA/OpenAI.
- **Confiança** < 0.65 → transfere para humano.
- **Saída inválida** (JSON quebrado/fora do schema) → transfere
  (`ASSIST_INVALID_AI_OUTPUT`).
- **Falha do provedor/timeout** → transfere (`ASSIST_AI_PROVIDER_FAILED`),
  conversa nunca quebra.
- **AiSettings** gateiam as ações: `canAnswerPricing/canSchedule/
  canReschedule/canCancel` são checadas no backend antes de executar a tool.

## 6. O que a IA pode / não pode fazer

**Pode:** entender intenção, responder dúvidas administrativas, consultar e
sugerir horários, criar/confirmar/cancelar/remarcar consultas (se permitido),
transferir para humano.

**Não pode:** dar diagnóstico, indicar remédios, interpretar sintomas, inventar
preços/horários, prometer disponibilidade sem consultar a agenda, acessar o
banco diretamente, ver dados de outra clínica, expor a chave/prompt/IDs
internos.

## 7. Fallback humano

Ocorre em: mensagem sensível, `HUMAN_HELP`, `UNKNOWN`, baixa confiança, saída
inválida, falha do provedor, limite diário atingido, ou tool que exige uma
capacidade desativada. Efeito: mensagem AI + mensagem SYSTEM, status
`WAITING_HUMAN`, audit `ASSIST_TRANSFERRED_TO_HUMAN`.

## 8. Custo e limites

- `AiUsageLog` grava por chamada: provider, modelo, tokens, custo estimado,
  sucesso/erro.
- `ASSIST_DAILY_TOKEN_LIMIT` — ao atingir o total do dia (fuso da clínica), a
  Assist cai para o simulador por regras (`ASSIST_RULE_BASED_FALLBACK_USED`).
- Limites de histórico (`ASSIST_MAX_HISTORY_MESSAGES`), tamanho da mensagem
  (2000), timeout e `max_tokens` também protegem o custo.
- Métricas de uso do dia aparecem no topo de `/assist`.

## 9. Testar SEM API key

1. `npm install && npm run db:push && npm run db:seed`.
2. Garanta `OPENAI_API_KEY=""` e `ASSIST_USE_REAL_AI="false"`.
3. `npm run dev`, logue como OWNER, abra `/assist`.
4. O banner mostra **"Simulador por regras"**. Crie uma simulação e teste
   "quero marcar limpeza amanhã" — o fluxo do Prompt 12 funciona normalmente.

## 10. Testar COM API key (ou mock)

Real:
1. `OPENAI_API_KEY="sk-..."`, `ASSIST_USE_REAL_AI="true"`, `OPENAI_MODEL="gpt-4o-mini"`.
2. Reinicie o dev server. O banner mostra **"IA real ativa"**.

Offline (sem custo):
1. `OPENAI_API_KEY="mock"`, `ASSIST_USE_REAL_AI="true"`, `OPENAI_MODEL="mock"`.
2. Reinicie. O banner mostra **"IA real ativa · offline (mock)"**.

Depois:
- "quero marcar uma limpeza amanhã" → intenção `SCHEDULE_APPOINTMENT`,
  ferramenta `findAvailableSlots`, escolha "1" → consulta criada
  (`createdBySource=AI`, visível em `/agenda`).
- "quanto custa limpeza?" com `canAnswerPricing=false` → transfere para humano.
- "estou com muita dor, qual remédio tomar?" → mensagem segura + transferência,
  sem diagnóstico/medicação.
- `/auditoria` mostra `ASSIST_REAL_AI_USED`, `ASSIST_TOOL_EXECUTED`,
  `ASSIST_SENSITIVE_MESSAGE_DETECTED` etc. — sem chave nem prompt completo.

## 11. Estado conversacional e fluxos (Prompt 14)

O estado da assistente é padronizado em `Conversation.metadata.assist`
(`lib/assist/assist-state.ts`): `mode`, `currentIntent`, `flow`
(IDLE/SCHEDULING/RESCHEDULING/CANCELLING/CONFIRMING/TRANSFERRED_TO_HUMAN/
COMPLETED), `step`, `detectedServiceId/Name`, `detectedDate`,
`selectedAppointmentId`, `suggestedSlots` (com `option`), `lastToolName`,
`lastConfidence`. É um **view denormalizado** derivado do fluxo interno —
`getAssistState` é retrocompatível com conversas antigas (só `assistFlow`) e
com conversas sem metadata. Os slots sugeridos são persistidos e reusados; o
fluxo limpa o estado ao concluir ou transferir.

**Mensagens curtas** ("1", "2", "sim", "não", "amanhã", "sexta", "limpeza")
são tratadas ANTES da IA: quando há um fluxo ativo, o motor determinístico
(Prompt 12) resolve a continuação — a IA real só inicia intenções novas.

**Fluxos completos:**
- **Agendamento:** serviço + data (+ período) → `findAvailableSlots` → sugere
  até 3 → escolhe número → **revalida** → cria (`createdBySource=AI`).
- **Remarcação:** encontra consultas ativas → escolhe (se >1) → nova data →
  slots → escolhe → `RESCHEDULED`.
- **Cancelamento:** encontra consultas → escolhe (se >1) → confirma sim/não
  ("não" não altera nada).
- **Confirmação:** confirma a próxima `SCHEDULED`/`RESCHEDULED`; se já
  `CONFIRMED`, avisa; se nenhuma, transfere.

**Parser de datas** (`parsePatientDateExpression`): hoje/amanhã/depois de
amanhã, dias da semana, "próxima X", "dia N", dd/mm(/aaaa), + período
(manhã/tarde/noite). Usa o fuso da clínica; datas passadas rolam para a
próxima ocorrência; ambíguo demais → `date: null` (pergunta a data).
Limitação: não é NLP — expressões fora desses padrões pedem esclarecimento.

**Match de serviço** (`matchServiceFromMessage`): nome exato, parcial e
aliases (avaliação/consulta, limpeza/profilaxia, clareamento/clarear,
manutenção/aparelho/ortodontia, canal/endodontia). Retorna `match`,
`ambiguous` (2+ → pergunta) ou `none` (lista serviços).

**Slots** (`findAvailableSlots`): aceita `period` e `preferredProfessionalId`,
retorna `{ slots, reasonIfEmpty }` (SERVICE_INACTIVE / NO_PROFESSIONAL_LINKED /
NO_WORKING_HOURS / FULLY_BOOKED / INVALID_DATE) com `displayDate`/`displayTime`.

## 12. Testes automatizados (Vitest)

`npm run test` (ou `test:watch`). Cobrem os helpers puros críticos em
`tests/`: parser de datas, match de serviços, `getSuggestedSlotByOption` +
compatibilidade de estado, e o guardrail de mensagens sensíveis. Testes de
`findAvailableSlots` (integração com banco) são feitos manualmente (documentado
aqui) por dependerem do Prisma.

## 13. O que ainda NÃO foi implementado

- WhatsApp real / webhook / envio externo
- Embeddings / busca semântica
- Memória avançada / streaming em tempo real
- Anexos / áudio / imagem
- Templates de WhatsApp
- Supervisão humana avançada (aprovar cada ação da IA)
- Fine-tuning / multi-provider avançado
- Pagamento, Google Calendar, recorrência, prontuário
