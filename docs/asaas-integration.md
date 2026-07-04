# Integração Asaas (checkout + webhook) — Prompt 22

Onboarding automático: o site inicia uma assinatura → Asaas cobra → o **webhook**
confirma o pagamento → a clínica é **provisionada automaticamente**. Tudo
server-only; a `ASAAS_API_KEY` nunca vai para o frontend.

## Configuração (env)

```
ASAAS_ENABLED="false"       # true habilita a integração
ASAAS_MOCK_MODE="true"      # true simula customer/subscription/payment (sem rede)
ASAAS_ENVIRONMENT="sandbox" # sandbox | production
ASAAS_API_KEY=""            # server-only
ASAAS_BASE_URL_SANDBOX="https://sandbox.asaas.com/api/v3"
ASAAS_BASE_URL_PRODUCTION="https://api.asaas.com/v3"
ASAAS_WEBHOOK_TOKEN=""      # validado no header asaas-access-token; ≠ da API key
PUBLIC_CHECKOUT_ENABLED="false"
PUBLIC_CHECKOUT_ALLOWED_ORIGIN=""      # CORS do checkout público
PUBLIC_CHECKOUT_RATE_LIMIT_PER_HOUR="20"
```

- **Real** só quando `ASAAS_ENABLED=true` **e** `ASAAS_MOCK_MODE=false` **e** há
  `ASAAS_API_KEY` (`shouldCallAsaasReal`). Caso contrário, tudo é mock (ids fake +
  `paymentUrl` fake).
- A chave é enviada apenas no header `access_token` (server) — nunca logada
  (erros sanitizados em `asaas-errors.ts`), nunca no browser.

## Cliente (`lib/asaas/asaas-client.ts`)

`createAsaasCustomer`, `createAsaasSubscription` (cycle MONTHLY/YEARLY),
`getAsaasPayment`. `fetch` nativo com timeout (AbortController). Em mock, retorna
`mock_cus_*`, `mock_sub_*`, `mock_pay_*` + `paymentUrl` local.

## Checkout público (`lib/asaas/asaas-checkout-service.ts`)

`startPublicCheckout`:
1. `PUBLIC_CHECKOUT_ENABLED=true`; Plan ativo; **preço vem do Plan** (nunca do
   site); slug válido/não reservado/livre (inclusive não reservado por checkout
   AWAITING_PAYMENT); rate limit por e-mail.
2. Cria `CheckoutSession` PENDING → customer + subscription no Asaas/mock →
   atualiza para **AWAITING_PAYMENT** com ids externos + `paymentUrl`.
3. **NÃO cria Clinic/User** ainda.

`getPublicCheckoutStatus`: status seguro; se `PROVISIONED`, devolve `appUrl` +
"verifique seu e-mail" (nunca a senha provisória).

## Webhook (`app/api/webhooks/asaas/route.ts`)

- `POST`, valida `asaas-access-token` == `ASAAS_WEBHOOK_TOKEN` (timing-safe); token
  ausente/errado → **403**. Se `ASAAS_ENABLED=false` **e** `ASAAS_MOCK_MODE=false`
  → 403. Sempre **200** para evento válido tratado.
- **Idempotência**: `PaymentProviderEvent.payloadHash` (sha256 do evento) — um
  evento reentregue nunca é processado 2x; pagamento confirmado 2x **não** cria 2
  clínicas.
- **PAYMENT_CONFIRMED / PAYMENT_RECEIVED** → localiza a sessão por
  `externalSubscriptionId`/`externalPaymentId`; se já PROVISIONED, ignora; senão
  **provisiona** (`provisionClinic` source ASAAS_CHECKOUT: Clinic+Settings+
  AiSettings+WhatsAppIntegration+OWNER+Subscription ACTIVE+Invoice PAID+BillingEvent+
  PlatformAuditLog), envia **OWNER_WELCOME_CHECKOUT**, marca a sessão PROVISIONED.
- **PAYMENT_OVERDUE** → invoice OVERDUE + subscription PAST_DUE (se a clínica já
  existe).
- **PAYMENT_DELETED/REFUNDED/CHARGEBACK** → registra; se a sessão não foi
  provisionada, marca CANCELLED (nunca apaga clínica automaticamente).
- **PAYMENT_CREATED / desconhecidos** → registra + ignora (200).

## Provisionamento se o e-mail falhar

`provisionClinic` cria a clínica; o e-mail é enviado **depois** e nunca desfaz o
pagamento. Se falhar, o `EmailLog` fica FAILED e o founder usa **"Reenviar acesso"**
(gera nova senha provisória).

## Testar

- **Mock:** `ASAAS_ENABLED=true` + `ASAAS_MOCK_MODE=true` + `PUBLIC_CHECKOUT_ENABLED=true`
  + `ASAAS_WEBHOOK_TOKEN=<algo>`. `POST /api/public/checkout/start` → AWAITING_PAYMENT
  + `paymentUrl`. Simule `POST /api/webhooks/asaas` (header `asaas-access-token`)
  com `{"event":"PAYMENT_RECEIVED","payment":{"id":"pay_1","subscription":"<externalSubscriptionId>","value":397,"status":"RECEIVED"}}`
  → clínica provisionada. Reenvie → duplicate (sem 2ª clínica).
- **Sandbox:** `ASAAS_MOCK_MODE=false` + `ASAAS_API_KEY` sandbox + configure o
  webhook no painel Asaas apontando para `https://<host>/api/webhooks/asaas` com o
  token. Faça um pagamento de teste.

## Segurança / não implementado

`ASAAS_API_KEY` só server; webhook com token timing-safe; idempotência garantida;
preço/clinicId nunca do frontend. **Não implementado:** nota fiscal, cupons,
upgrade/downgrade automático, portal público de assinatura, cobrança por uso.
