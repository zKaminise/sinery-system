# WhatsApp Cloud API — Setup (Prompt 16, preparatório)

## 1. O que foi implementado neste prompt

- Modelo Prisma `WhatsAppIntegration` (1 por clínica) + enum
  `WhatsAppIntegrationStatus`.
- Camada server-only `lib/whatsapp/` (config por env, cliente Graph SEM envio,
  health, queries, validação, mask, schemas).
- Validação segura da configuração (**sem chamada externa**) + resolução de
  status.
- Tela administrativa `/configuracoes/whatsapp` (card + checklist + botão
  "Verificar configuração").
- Seção segura de WhatsApp em `/status` e `/api/health/deep`.
- Auditoria de todas as ações.
- Seed idempotente (integração dev sem token).
- Testes Vitest dos helpers puros.

## 2. O que ainda NÃO foi implementado

Webhook real de recebimento (Prompt 17), envio real de mensagens (Prompt 18),
fluxo WhatsApp + Assist + humano (Prompt 19), templates, mídia, áudio,
pagamento, Google Calendar, produção/staging. **Nenhuma** chamada à Graph API
é feita neste prompt.

## 3. Variáveis de ambiente

| Env | Sensível? | Uso |
|---|---|---|
| `WHATSAPP_CLOUD_API_ENABLED` | não | liga/desliga a integração |
| `WHATSAPP_GRAPH_API_VERSION` | não | ex.: `v20.0` |
| `WHATSAPP_ACCESS_TOKEN` | **SIM** | Bearer da Graph API (server-only) |
| `WHATSAPP_PHONE_NUMBER_ID` | não | id do número |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | não | id da WABA |
| `WHATSAPP_APP_ID` | não | id do app Meta |
| `WHATSAPP_APP_SECRET` | **SIM** | assina/valida o webhook (Prompt 17) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **SIM** | handshake do webhook (Prompt 17) |
| `WHATSAPP_WEBHOOK_PATH` | não | caminho do webhook |
| `WHATSAPP_SEND_MESSAGES_ENABLED` | não | **manter false** neste prompt |
| `WHATSAPP_WEBHOOK_ENABLED` | não | **manter false** neste prompt |
| `WHATSAPP_ALLOW_CONFIG_LIVE_CHECK` | não | **manter false** (sem chamada externa) |

Com tudo vazio, o sistema roda normalmente e mostra "WhatsApp não configurado".

## 4. O que fica no banco

`enabled`, `provider`, `businessAccountId`, `phoneNumberId`, `appId`,
`displayPhoneNumber`, `verifiedName`, `webhookPath`,
`webhookVerifyTokenConfigured` (boolean), `sendMessagesEnabled`,
`webhookEnabled`, `status`, `lastConfigCheck*`, timestamps.

## 5. O que NÃO fica no banco

`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` e o valor real do
`WHATSAPP_WEBHOOK_VERIFY_TOKEN` **nunca** são persistidos — apenas um booleano
`webhookVerifyTokenConfigured`. Segredos vivem só em env server-side.

## 6. Como acessar a tela

`/configuracoes` → card "Integração WhatsApp Cloud API" → `/configuracoes/whatsapp`.
OWNER/ADMIN gerenciam; RECEPTIONIST vê somente leitura; PROFESSIONAL não acessa
(bloqueado no servidor).

## 7. Como verificar configuração

Botão **"Verificar configuração"** (OWNER/ADMIN) → `POST
/api/whatsapp/integration/check`. Valida presença/consistência das envs,
sincroniza ids não-sensíveis, grava `lastConfigCheckAt/status/message` e
registra auditoria. **Não** envia mensagem nem chama a Graph API.

## 8. Como preparar o app Meta/WhatsApp (futuro)

1. Crie um app no Meta for Developers e adicione o produto **WhatsApp**.
2. Pegue o **Phone Number ID** e o **WhatsApp Business Account ID**.
3. Gere um **Access Token** (temporário para testes; System User para produção).
4. Defina um **Verify Token** (string sua) e o **App Secret** do app.
5. Preencha as envs no `.env` (nunca commitar) e rode "Verificar configuração".

## 9. Diferença entre as credenciais

- **Phone Number ID**: identifica o número que envia/recebe (não é o telefone).
- **WhatsApp Business Account (WABA) ID**: a conta comercial que agrupa números.
- **App ID**: identifica o app no Meta for Developers.
- **App Secret**: segredo do app; usado para validar a assinatura do webhook.
- **Access Token**: Bearer para chamar a Graph API (enviar/ler).
- **Webhook Verify Token**: string combinada usada no handshake de verificação
  do webhook (GET do Meta).

## 10. Segurança

- Não expor token/segredo na UI (só "Configurado"/"Não configurado").
- Não logar segredos; AuditLog guarda apenas metadados seguros (booleans/ids).
- Em produção, migrar segredos para Secret Manager/criptografia.
- Em staging, usar variáveis de ambiente.
- Nunca commitar `.env`.

## 11. Próximos prompts

- **Prompt 17**: webhook real de recebimento (handshake GET + validação de
  assinatura `X-Hub-Signature-256` com o App Secret; cria Conversation/Message).
- **Prompt 18**: envio real de mensagens (POST na Graph API).
- **Prompt 19**: fluxo completo WhatsApp + Sinery Assist + atendimento humano.
