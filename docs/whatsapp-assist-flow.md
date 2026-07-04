# WhatsApp ↔ Sinery Assist ↔ Humano (Prompt 19)

Fluxo completo: mensagem inbound WhatsApp → Conversation/Message → Sinery Assist
processa (quando permitido) → responde/agenda/remarca/cancela/confirma ou
transfere para humano → resposta enviada pelo WhatsApp → humano assume/devolve.

## 1. Flags

| Env | Padrão | O quê |
|---|---|---|
| `WHATSAPP_AUTO_PROCESS_ASSIST` | false | inbound aciona a Assist automaticamente |
| `WHATSAPP_ASSIST_REPLY_ENABLED` | false | permite ENVIAR a resposta pelo WhatsApp (false → só interna) |
| `WHATSAPP_SEND_MESSAGES_ENABLED` | false | envio (real/mock) habilitado |
| `WHATSAPP_SEND_MOCK_MODE` | false | não chama a Graph API |
| `WHATSAPP_REQUIRE_24H_WINDOW` | true | exige janela de 24h |
| `WHATSAPP_ASSIST_MAX_AUTO_REPLIES_PER_CONVERSATION_PER_HOUR` | 20 | anti-flood/loop |
| `WHATSAPP_ASSIST_MAX_AUTO_REPLIES_PER_INBOUND` | 1 | 1 resposta por inbound |
| `WHATSAPP_ASSIST_PROCESSING_TIMEOUT_MS` | 20000 | timeout no webhook |
| `ASSIST_GLOBAL_DISABLED` / `AiSettings.enabled` | — | kill switches |

**Por que auto-process começa false:** para evitar respostas automáticas em
produção antes dos testes. Ative em dev/staging.

## 2. Quando a Assist responde

Somente `INBOUND`/`PATIENT` em conversa `WHATSAPP` **AI_HANDLING**, com
`WHATSAPP_AUTO_PROCESS_ASSIST=true`, `AiSettings.enabled=true` e
`ASSIST_GLOBAL_DISABLED=false`. **Nunca** responde em `HUMAN_HANDLING`,
`WAITING_HUMAN` ou `CLOSED`; nunca processa `OUTBOUND`/`AI`/`HUMAN`/`SYSTEM`
nem status webhooks.

## 3. Como o webhook aciona a Assist

Após salvar o inbound (Prompt 17), se `autoOn` e a conversa é `AI_HANDLING`, o
webhook chama `processWhatsAppInboundWithAssist(WEBHOOK_AUTO)` de forma
**síncrona porém protegida** por `Promise.race` (timeout) + try/catch — o
webhook **sempre** retorna 200 à Meta. Conversas novas/reabertas nascem
`AI_HANDLING` quando `autoOn`, senão `WAITING_HUMAN`. (Em produção o ideal é
uma fila/worker; documentado como limitação.)

## 4. Como a resposta é enviada

`processAssistMessage` roda com `skipSaveInbound=true` + `persistAiReplies=false`
(o inbound já foi salvo; a resposta AI não é persistida ali). A resposta é
enviada por `sendWhatsAppAssistReply` (senderType **AI**, sem auto-assume):

- `WHATSAPP_ASSIST_REPLY_ENABLED=false` ou `SEND` off ou fora da janela →
  `deliveryStatus INTERNAL_ONLY` (sem Graph) → UI "Gerada internamente".
- mock → `MOCK_SENT`. real → `SENT` (+`externalMessageId`) ou `FAILED`.
- Falha de envio → conversa vai `WAITING_HUMAN`.

## 5. Idempotência (`AssistProcessingRun`)

`@@unique([inboundMessageId])` garante **1 resposta por inbound**. Reenvio do
webhook / duplo trigger → `WHATSAPP_ASSIST_PROCESSING_DUPLICATE_IGNORED`. Cada
run guarda mode/trigger/status/intent/confidence + outboundMessageId (sem
prompt/payload). Limite de auto-replies por conversa por hora.

## 6. Humano assume / devolve

- **Assumir**: humano envia pelo composer (ou ação "assumir") → `HUMAN_HANDLING`
  + assignedUser. A Assist **para** de responder. Se um humano assume no meio do
  processamento, o reply é abortado (`WHATSAPP_ASSIST_SKIPPED_HUMAN_HANDLING`).
  Ao responder em `AI_HANDLING`, o humano **assume automaticamente** (aviso na UI).
- **Devolver para Assist**: ação `return_to_ai` → `AI_HANDLING`. O próximo
  inbound é auto-processado (se `autoOn`).
- **Processar com Sinery Assist** (botão): processa a última mensagem manualmente
  (`MANUAL_BUTTON`); se `WAITING_HUMAN`, devolve para a Assist antes.

## 7. Interno / mock / real

- **INTERNAL_ONLY**: resposta gerada e salva, **não** enviada ao WhatsApp
  (reply/send off ou fora da janela). UI: "Gerada internamente".
- **MOCK_SENT**: mock (sem Graph). UI: "Mock — não enviada à Meta".
- **SENT/DELIVERED/READ**: envio real (status via webhook do Prompt 18).

## 8. Auditoria

`WHATSAPP_ASSIST_AUTO_TRIGGERED`/`MANUAL_TRIGGERED`/`REPLY_GENERATED`/`REPLY_SENT`/
`REPLY_INTERNAL_ONLY`/`REPLY_FAILED`/`PROCESSING_SKIPPED`/`PROCESSING_DUPLICATE_IGNORED`/
`SKIPPED_HUMAN_HANDLING`/`SKIPPED_WAITING_HUMAN`/`ENABLED_FOR_CONVERSATION`/
`TRANSFERRED_TO_HUMAN`. Nunca grava prompt/payload/token/conteúdo — só
conversationId/inboundMessageId/outboundMessageId/runId/trigger/status/intent/
confidence/deliveryStatus.

## 9. Testar em mock mode

```
WHATSAPP_CLOUD_API_ENABLED=true WHATSAPP_WEBHOOK_ENABLED=true
WHATSAPP_SEND_MESSAGES_ENABLED=true WHATSAPP_SEND_MOCK_MODE=true
WHATSAPP_REQUIRE_24H_WINDOW=true WHATSAPP_VERIFY_SIGNATURE=false
WHATSAPP_PHONE_NUMBER_ID=123456789 WHATSAPP_AUTO_PROCESS_ASSIST=true
WHATSAPP_ASSIST_REPLY_ENABLED=true ASSIST_USE_REAL_AI=false
```
1. Habilite a integração da clínica. 2. POST fake inbound "quero marcar limpeza
segunda à tarde" → a Assist responde `MOCK_SENT` com os horários. 3. POST "1" →
consulta em `/agenda`. 4. Assuma como humano → novo inbound NÃO é respondido.
5. Devolva para Assist → volta a responder. 6. Sensível ("muita dor, remédio")
→ transfere para humano. 7. Reenvie o mesmo inbound → não duplica.

## 10. Testar com WhatsApp real

`WHATSAPP_SEND_MOCK_MODE=false` + token/phone reais. Envie do celular, a Assist
responde, "1" agenda, humano assume e a Assist para. Use número de teste, dentro
da janela; templates ficam para depois.

## 11. Riscos de produção / ainda NÃO implementado

Processamento síncrono no webhook (produção pede fila/worker). NÃO implementado:
templates, envio fora da janela, mídia, áudio, documentos, botões/interativos,
fila/Redis, retry/dead-letter queue, realtime, supervisão humana avançada,
evals de IA, pagamento, Google Calendar.
