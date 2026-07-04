# Contrato de checkout para o site — Prompt 22

O site institucional (repositório separado) só precisa chamar **dois endpoints**.
Ele **nunca** recebe `ASAAS_API_KEY` nem `RESEND_API_KEY` — apenas fala com o
sistema Sinery.

## URLs por ambiente

| Ambiente | Base |
|---|---|
| Local | `http://localhost:3000` |
| Staging | `https://staging.app.sinery.com.br` |
| Produção | `https://app.sinery.com.br` |

Ex.: `POST https://staging.app.sinery.com.br/api/public/checkout/start` e
`GET https://staging.app.sinery.com.br/api/public/checkout/{publicId}`.

## 1. Iniciar assinatura

`POST https://<sistema>/api/public/checkout/start`

**Body (JSON):**
```json
{
  "planSlug": "pro-clinic",
  "clinicName": "Clínica Sorria",
  "desiredSlug": "clinica-sorria",
  "ownerName": "Ana Silva",
  "ownerEmail": "ana@clinica.com.br",
  "ownerPhone": "34999999999",
  "companyDocument": "opcional",
  "city": "Uberlândia",
  "state": "MG"
}
```

- **Obrigatórios:** `planSlug`, `clinicName`, `desiredSlug`, `ownerName`, `ownerEmail`.
- **NUNCA envie** `amountInCents`/`price`/`clinicId`/`planId` — o preço vem do
  Plan no servidor (qualquer campo de preço enviado é ignorado).

**Response 201:**
```json
{
  "ok": true,
  "data": {
    "publicId": "48a7f0ea3dc645fc29a36fa5",
    "status": "AWAITING_PAYMENT",
    "paymentUrl": "https://.../checkout/...",
    "expiresAt": "2026-07-11T...",
    "plan": { "name": "Pro Clinic", "amountInCents": 39700 }
  }
}
```

**Erros:** 400 (dados/slug/plano inválido), 403 (`PUBLIC_CHECKOUT_ENABLED=false`),
409 (slug já em uso/reservado), 429 (rate limit), 502 (falha no provedor).

→ **Redirecione o usuário para `data.paymentUrl`** para pagar.

## 2. Consultar status

`GET https://<sistema>/api/public/checkout/{publicId}`

**Response:**
```json
{
  "ok": true,
  "data": {
    "status": "PROVISIONED",
    "plan": "Pro Clinic",
    "amountInCents": 39700,
    "paymentUrl": "...",
    "appUrl": "https://clinica-sorria.app.sinere.com.br",
    "ownerEmail": "ana@clinica.com.br",
    "message": "Acesso criado! Verifique seu e-mail para a senha provisória."
  }
}
```
- **Nunca** retorna senha provisória nem dados sensíveis.

## 3. Estados possíveis

`PENDING` → `AWAITING_PAYMENT` → (pagamento) → `PROVISIONING` → `PROVISIONED`.
Também: `FAILED`, `CANCELLED`, `EXPIRED`.

**Quando `PROVISIONED`:** mostre "Pronto! Enviamos o acesso para seu e-mail" e o
link `appUrl`. O e-mail (OWNER_WELCOME_CHECKOUT) leva a senha provisória — o site
não a recebe.

## 4. Fluxo recomendado do site

1. Formulário → `POST /start` → redireciona para `paymentUrl`.
2. Página de retorno faz *polling* de `GET /{publicId}` até `PROVISIONED`.
3. O pagamento é confirmado pelo **webhook do Asaas** (server↔server) — não depende
   do site estar aberto. O polling é só para UX.

## 5. Segurança

- Chaves (Asaas/Resend) **só no servidor Sinery**; o site nunca as vê.
- **CORS + Origin check (implementado):** defina
  `PUBLIC_CHECKOUT_ALLOWED_ORIGIN=https://sinery.com.br,https://www.sinery.com.br`
  (aceita lista separada por vírgula). O sistema devolve `Access-Control-Allow-Origin`
  para essa origem **e** valida o header `Origin`: em staging/produção, requisições
  de browser com Origin fora da lista recebem **403** (`isCheckoutOriginAllowed`).
  Chamadas server-to-server (sem header `Origin`) são permitidas. Em dev local, sem
  lista configurada, só `localhost` passa.
- Rate limit por e-mail (`PUBLIC_CHECKOUT_RATE_LIMIT_PER_HOUR`).

## 6. Testar

- **Mock:** `PUBLIC_CHECKOUT_ENABLED=true` + `ASAAS_ENABLED=true` +
  `ASAAS_MOCK_MODE=true` + `ASAAS_WEBHOOK_TOKEN=<algo>`. `/start` devolve
  `paymentUrl` fake; simule o webhook (ver [asaas-integration.md](./asaas-integration.md)).
- **Sandbox:** `ASAAS_MOCK_MODE=false` + `ASAAS_API_KEY` sandbox + webhook no painel
  Asaas apontando para `/api/webhooks/asaas`.
- **Produção:** `ASAAS_ENVIRONMENT=production` + chave de produção + `EMAIL_MOCK_MODE=false`
  + Resend com domínio verificado.
