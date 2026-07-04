# Vercel — staging & produção — Prompt 23

## Projeto SITE (separado)

- Domínios: `sinery.com.br`, `www.sinery.com.br`.
- Envs do site: apenas a URL do sistema (ex.: `NEXT_PUBLIC_SINERY_API=https://staging.app.sinery.com.br`).
- **NUNCA** coloque `ASAAS_API_KEY`/`RESEND_API_KEY` no site — ele só chama a API do sistema.

## Projeto SISTEMA (este repositório)

### Domínios
- `staging.app.sinery.com.br` (branch/preview de homologação).
- `app.sinery.com.br` (produção, futuro).

### Build & Install
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Prisma Client:** gerado no build. Garanta `prisma generate` — adicione um
  `postinstall` se necessário (`"postinstall": "prisma generate"`), OU rode
  `npm run db:generate` no build. O `next build` importa `lib/generated/prisma`,
  então o client precisa existir.
- **O build NÃO deve rodar `db:push` nem `db:seed`.** (Confirme que o Build Command
  é só `npm run build`.)

### Migrations (fora do build)
Rode `npm run db:migrate:deploy` **antes** de servir a nova versão — como um passo
de CI/deploy separado do build (Vercel não roda migration no build por padrão).
Opções:
1. **Manual:** localmente/CI com a `DATABASE_URL` do ambiente → `npm run db:migrate:deploy`.
2. **CI (GitHub Actions):** step que roda `prisma migrate deploy` com o secret
   `DATABASE_URL` antes do deploy production.

> Nunca `prisma db push` em staging/produção — só `migrate deploy`.

### Env vars (por ambiente na Vercel)
Configure em **Project → Settings → Environment Variables**, escopo Preview
(staging) e Production separados. Lista completa em
[environment-variables.md](./environment-variables.md) e
[deploy-staging.md](./deploy-staging.md). Mínimo:
`APP_ENV`, `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_ROOT_DOMAIN`, `DEFAULT_TENANT_SLUG`, + Sentry + (quando reais)
Resend/Asaas.

### Seed
- **Produção:** NÃO rodar seed (é bloqueado por `NODE_ENV=production`).
- **Staging:** rode `npm run db:seed` **manualmente** só se quiser os dados de
  demonstração (ou crie founder+planos por um seed controlado — ver
  [database-staging.md](./database-staging.md)). Nunca no build automático.

### Commit/versão
A Vercel expõe `VERCEL_GIT_COMMIT_SHA` — o `/api/health/deep` e o `/status` mostram
o commit curto + `APP_ENV` + versão.
