# Deploy & ambientes (staging/produção) — Prompt 23

Guia de ambientes do **sistema** Sinery System. O site institucional é um projeto
separado (ver [domains-and-dns.md](./domains-and-dns.md)).

## Ambientes

| | **LOCAL** | **STAGING** | **PRODUCTION** |
|---|---|---|---|
| Domínio | localhost:3000 | staging.app.sinery.com.br | app.sinery.com.br |
| `APP_ENV` | (vazio) | `staging` | `production` |
| Banco | Docker/Prisma dev | Postgres remoto **staging** | Postgres remoto **produção** (separado) |
| Schema | `db:push` ok | `db:migrate:deploy` | `db:migrate:deploy` |
| `AUTH_SECRET` | qualquer | **real ≥32** | **real ≥32** |
| `EMAIL_MOCK_MODE` | `true` | `false` (se Resend pronto) | `false` |
| `ASAAS_ENVIRONMENT` | sandbox | sandbox | production |
| `ASAAS_MOCK_MODE` | `true` | `false` só p/ testar sandbox | `false` |
| WhatsApp | mock | mock (a princípio) | real, `WHATSAPP_AUTO_PROCESS_ASSIST=false` |
| OpenAI | `false`/`mock` | `false` | real, com limites |
| Sentry | opcional | **ligado** | **ligado** |
| Seed | livre | controlado (founder+planos) | **nunca fake** |

## Como o app determina o ambiente

`APP_ENV` (ou `SINERY_ENV`) = `staging` | `production`. Sem isso, cai em
`local`/`production` conforme `NODE_ENV` (`lib/env/env-readiness.ts resolveAppEnv`).
Defina `APP_ENV` nas variáveis da Vercel de cada ambiente.

## Readiness

`GET /api/health/deep` retorna um bloco `readiness` com `readyForStaging`,
`readyForProduction`, `missingRequired` (só NOMES de env, nunca valores),
`warnings` e `criticalIssues`. O `/status` mostra isso. Regras
(`evaluateEnvReadiness`):
- **Bloqueia staging/prod:** `AUTH_SECRET` fraco/placeholder; faltar
  `DATABASE_URL`/`NEXT_PUBLIC_APP_URL`; faltar chave de um serviço ligado
  (Resend/Asaas/WhatsApp/OpenAI).
- **Bloqueia só produção (critical):** `EMAIL_MOCK_MODE=true`,
  `ASAAS_MOCK_MODE=true` (com Asaas on), `WHATSAPP_SEND_MOCK_MODE=true` (com envio on).

## Envs por categoria

Detalhe completo em [environment-variables.md](./environment-variables.md). Resumo:

- **Obrigatórias (todo ambiente):** `DATABASE_URL` 🔒, `AUTH_SECRET` 🔒,
  `NEXT_PUBLIC_APP_URL`, `DEFAULT_TENANT_SLUG`.
- **Ambiente:** `APP_ENV`, `NODE_ENV` (auto na Vercel).
- **Segredos (server-only):** `AUTH_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`,
  `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_APP_SECRET`, `OPENAI_API_KEY`, `SENTRY_AUTH_TOKEN`.
- **Públicas seguras (`NEXT_PUBLIC_*`):** `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_SENTRY_DSN`.
- **Mock (dev/staging):** `EMAIL_MOCK_MODE`, `ASAAS_MOCK_MODE`,
  `WHATSAPP_SEND_MOCK_MODE`, `ASSIST_USE_REAL_AI=false`.

## Comandos

**Local:** `npm install && npm run db:generate && npm run db:push && npm run db:seed && npm run dev`
**Staging/prod (deploy):** `npm run db:migrate:deploy` (nunca `db:push`), `npm run db:generate`, `npm run build`, `npm start`.

Ver também: [database-staging.md](./database-staging.md), [vercel-staging.md](./vercel-staging.md),
[staging-test-plan.md](./staging-test-plan.md).
