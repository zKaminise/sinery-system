# WhatsApp Webhook — Recebimento (Prompt 17)

Recebimento REAL de eventos do WhatsApp Cloud API. **Não envia** mensagens nem
chama a Graph API (envio é o Prompt 18).

## 1. O que foi implementado

- Endpoint `app/api/webhooks/whatsapp/route.ts` (GET verificação + POST eventos).
- Validação de assinatura HMAC `X-Hub-Signature-256`.
- Parser seguro do payload (text, mídia→fallback, interativo→fallback, status).
- Idempotência via `WhatsAppWebhookEvent.payloadHash` único + wamid.
- Mapeamento `phone_number_id` → `WhatsAppIntegration`/clínica.
- Criação/reabertura de `Conversation` (canal WHATSAPP) + `Message` INBOUND real.
- Associação de paciente por telefone (match único).
- `lastMessageReceivedAt` / `lastWebhookVerifiedAt` atualizados.
- Registro de status events.
- Auditoria completa + observabilidade em `/status`, `/api/health/deep`,
  `/configuracoes/whatsapp`.
- Badge WhatsApp no inbox; envio humano bloqueado em conversas WHATSAPP.

## 2. GET (verificação)

A Meta chama `GET {webhookPath}?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`.
- `WHATSAPP_WEBHOOK_ENABLED` precisa ser `true` (senão 403).
- `hub.mode !== "subscribe"` → 400.
- `hub.verify_token !== WHATSAPP_WEBHOOK_VERIFY_TOKEN` → 403.
- OK → responde **texto puro** com `hub.challenge` (200) e grava
  `lastWebhookVerifiedAt` + `WHATSAPP_WEBHOOK_VERIFIED`.
- O verify token nunca é ecoado nem logado.

## 3. POST (recebimento)

- `WHATSAPP_WEBHOOK_ENABLED=false` → 403 sem processar.
- Lê o **raw body** (necessário para a assinatura).
- Se `WHATSAPP_VERIFY_SIGNATURE=true`: valida HMAC-SHA256 do raw body com
  `WHATSAPP_APP_SECRET` (constant-time). Inválida/ausente → 403 +
  `WHATSAPP_WEBHOOK_SIGNATURE_INVALID`.
- Faz `JSON.parse` (inválido → 200 ignorado).
- Parseia e processa eventos; **sempre responde 200** para payload
  processado/ignorado com segurança (evita retries agressivos da Meta).

## 4. Assinatura

`lib/whatsapp/whatsapp-signature.ts`: `verifyWhatsAppSignature(rawBody, header,
appSecret)` calcula `HMAC-SHA256(rawBody, appSecret)` e compara com o header
`sha256=<hex>` em `timingSafeEqual`. Retorna false se header ausente/malformado
ou app secret vazio.

## 5. Parser

`lib/whatsapp/whatsapp-webhook-parser.ts` → `parseWhatsAppWebhookPayload` →
`{ events, ignoredReasons }`. Navega `entry[].changes[].value` extraindo
`metadata.phone_number_id`, `contacts[].profile.name`, `messages[]`,
`statuses[]`. Nunca lança em payload desconhecido (vira `ignoredReasons`).
Tipos: `text` (body), mídia (`image/audio/video/...`) → fallback
"[Mensagem de mídia recebida...]", `interactive/button/desconhecido` → fallback
interativo. **Não baixa mídia**. Não loga/persiste payload cru.

## 6. Idempotência

`payloadHash = sha256(chave estável do evento)`:
- message → `msg:{phoneNumberId}:{wamid}`
- status → `st:{phoneNumberId}:{statusId}:{status}:{timestamp}`
`WhatsAppWebhookEvent.payloadHash` é único → reenvio do mesmo evento é
detectado (`WHATSAPP_MESSAGE_DUPLICATE_IGNORED`). Camada extra: se já existe
`Message.externalMessageId === wamid` na clínica, ignora.

## 7. phoneNumberId → clínica

Busca `WhatsAppIntegration` com `phoneNumberId` igual **e** `enabled=true`.
Fallback DEV: se `WHATSAPP_PHONE_NUMBER_ID` (env) bate e existe exatamente 1
integração habilitada, usa ela. `phoneNumberId` desconhecido → evento gravado
sem clínica, ignorado, log seguro (sem criar Conversation/Message).

## 8. Conversation / Message

Para cada mensagem:
1. Normaliza o telefone (`normalizeWhatsAppPhone`).
2. Associa paciente por telefone (match único → `patientId`).
3. Conversa aberta WHATSAPP existente (`externalContactId = telefone`, status
   != CLOSED) → anexa. Só CLOSED → **reabre** como WAITING_HUMAN + SYSTEM
   "Conversa reaberta...". Nenhuma → **cria** WHATSAPP WAITING_HUMAN.
   (WAITING_HUMAN porque ainda não há resposta automática/real neste prompt.)
4. Cria `Message` INBOUND/PATIENT com `externalMessageId/externalChannel/
   externalTimestamp` + metadata `{source, whatsappMessageId, messageType,
   fromPhone, contactName, phoneNumberId, receivedAt}`.
5. Atualiza `lastMessageReceivedAt` + auditoria.

## 9. Associação de paciente

`phonesMatch` compara pelos últimos dígitos (robusto a formatação/DDI). Match
único → associa + `PATIENT_MATCHED_FROM_WHATSAPP`. Múltiplos →
`PATIENT_MATCH_AMBIGUOUS_FROM_WHATSAPP`, sem associar. Nenhum → contato sem
paciente. **Não cria paciente** por padrão (`WHATSAPP_AUTO_CREATE_PATIENT=false`).

## 10. Status events

`sent/delivered/read/failed/...` → grava `WhatsAppWebhookEvent(eventType=status)`
+ `WHATSAPP_STATUS_RECEIVED` (e `WHATSAPP_STATUS_FAILED_RECEIVED` em failed).
**Prompt 18:** agora também atualiza o `deliveryStatus` da Message outbound
correspondente (por `externalMessageId`), sem regressão — ver
[whatsapp-send.md](./whatsapp-send.md#9-webhook-status--message).

## 11. Testes locais com curl

```bash
# GET verification (espera "12345")
curl "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=fake-verify&hub.challenge=12345"

# GET token errado (espera 403)
curl -i "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=12345"

# POST mensagem text (WHATSAPP_VERIFY_SIGNATURE=false p/ dev)
curl -X POST http://localhost:3000/api/webhooks/whatsapp -H "Content-Type: application/json" -d '{
  "object":"whatsapp_business_account",
  "entry":[{"id":"WABA","changes":[{"value":{
    "metadata":{"display_phone_number":"5534999990000","phone_number_id":"123456789"},
    "contacts":[{"profile":{"name":"João"},"wa_id":"5534999990000"}],
    "messages":[{"from":"5534999990000","id":"wamid.TEST1","timestamp":"1710000000","type":"text","text":{"body":"Olá"}}]
  }}]}]
}'
# Reenviar o MESMO POST → não duplica (idempotência).
```

Com `WHATSAPP_VERIFY_SIGNATURE=true`, gere a assinatura:
`printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$APP_SECRET"` e envie no
header `X-Hub-Signature-256: sha256=<hash>`.

## 12. ngrok / staging

Localhost não é acessível pela Meta. Use um túnel (`ngrok http 3000`) ou um
ambiente de staging com HTTPS e configure a URL pública
`https://SEU-DOMINIO/api/webhooks/whatsapp` no painel da Meta com o mesmo
verify token.

## 13. Ainda NÃO implementado

Envio real, templates, mídia completa, download de anexos, resposta automática
da Assist no WhatsApp, assinatura obrigatória em produção com segredo real,
dashboard avançado de eventos, retry/dead-letter queue, realtime.
