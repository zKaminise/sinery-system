# WhatsApp — Envio de texto (Prompt 18)

Envio REAL (ou mock) de mensagens de **texto** pelo inbox `/conversas`, usando a
integração dos Prompts 16/17. **Não** implementa templates, mídia, nem resposta
automática da Assist.

## 1. O que foi implementado

- Cliente server-only `sendWhatsAppText` (Graph `POST /{phone-number-id}/messages`).
- Orquestrador `sendWhatsAppTextMessage` (validação → Message PENDING → envio →
  SENT/MOCK_SENT/FAILED → auditoria).
- Rota `/api/conversations/[id]/messages`: canal WHATSAPP → envia; INTERNAL_SIMULATOR inalterado.
- `MessageDeliveryStatus` (INTERNAL_ONLY/PENDING/SENT/DELIVERED/READ/FAILED/MOCK_SENT).
- Webhook status → atualiza a Message outbound (sem regressão).
- Composer WhatsApp com estados; badges de entrega no thread.
- `/configuracoes/whatsapp`, `/status`, `/api/health/deep` com estado de envio seguro.

## 2. Como habilitar o envio

```
WHATSAPP_CLOUD_API_ENABLED="true"
WHATSAPP_SEND_MESSAGES_ENABLED="true"
WHATSAPP_ACCESS_TOKEN="EAA..."   # real
WHATSAPP_PHONE_NUMBER_ID="..."
```
E a integração da clínica precisa estar `enabled=true` com `phoneNumberId`.

## 3. Mock mode (dev sem token)

```
WHATSAPP_SEND_MESSAGES_ENABLED="true"
WHATSAPP_SEND_MOCK_MODE="true"
```
Nesse modo o envio **não chama** a Graph API: gera `mock_wamid_<...>`,
`deliveryStatus = MOCK_SENT`, e registra `WHATSAPP_SEND_MOCKED`. A UI mostra
"Mock — não enviado à Meta".

## 4. Testar com webhook fake

1. Receba uma mensagem via webhook (Prompt 17) — cria a Conversation WHATSAPP e
   abre a janela de 24h.
2. Abra `/conversas`, entre na conversa, responda pelo composer.
3. Confirme a Message OUTBOUND/HUMAN + status.

## 5. Testar com número real

Configure token/phone real, `WHATSAPP_SEND_MOCK_MODE="false"`, receba uma
mensagem do seu celular no número de teste, responda pelo inbox e confirme a
entrega. Use número de teste — não um cliente real.

## 6. Janela de 24 horas

WhatsApp só permite **texto livre** dentro de 24h da última mensagem do
paciente. `WHATSAPP_REQUIRE_24H_WINDOW="true"` bloqueia fora da janela com:
"A janela de atendimento de 24 horas expirou. O envio com template será
implementado em etapa futura." (`isWithinWhatsAppServiceWindow` +
`getLastInboundWhatsAppMessageAt`). Em dev, `false` desativa a checagem (mostra
alerta na UI/status).

## 7. Por que templates ainda não

Fora da janela, a Meta exige **templates aprovados** (HSM). Templates,
componentes e aprovação de mensagens ficam para um prompt futuro.

## 8. deliveryStatus

`PENDING` (criada) → `SENT` (Graph OK) → `DELIVERED` → `READ` (via webhook). Em
mock: `MOCK_SENT`. Em falha: `FAILED` (+ `deliveryErrorCode/Message`
sanitizados + `failedAt`). O status **nunca regride** (`applyDeliveryStatus`):
`READ` não volta para `DELIVERED`; `FAILED` só sobrescreve se ainda não
entregue/lido.

## 9. Webhook status → Message

Ao receber `sent/delivered/read/failed`, o processador encontra a Message
`OUTBOUND` por `externalMessageId` + `externalChannel=WHATSAPP` e aplica o
status (com a regra de não-regressão) + audita `WHATSAPP_MESSAGE_STATUS_UPDATED`
/ `WHATSAPP_MESSAGE_DELIVERY_FAILED`. Status de mensagem desconhecida é ignorado
com segurança (o evento ainda é gravado).

## 10. Erros da Graph API

`sanitizeWhatsAppApiError` remove token/Authorization/headers e trunca. A UI
recebe uma mensagem amigável ("Não foi possível enviar a mensagem pelo WhatsApp
agora..."). A Message vira `FAILED` (rastreável), e audita
`WHATSAPP_MESSAGE_SEND_FAILED`. Timeout via `WHATSAPP_SEND_TIMEOUT_MS`.

## 11. Segurança do token

O access token é lido **só no servidor** (`getWhatsAppHeaders`), **nunca** vai
ao browser, aos logs, ao AuditLog nem ao banco. Auditoria guarda apenas
metadados seguros (conversationId, messageId, externalMessageId, deliveryStatus,
mock, `toPhoneMasked`, userId, errorCode) — **não** o conteúdo da mensagem.

## 12. Ainda NÃO implementado

Templates, envio fora da janela com template, resposta automática da Assist,
mídia, áudio, documentos, retry/dead-letter queue, painel avançado de entrega,
multi-número por clínica, opt-in formal, compliance avançado, realtime.
