# Vercel — staging & produção — Prompt 23

## Topologia de projetos Vercel

Três projetos Vercel possíveis, cada um com **Environment Variables próprias**:

| Projeto | Domínio(s) | Aponta p/ este repo? |
|---|---|---|
| **SITE** (institucional) | `sinery.com.br`, `www.sinery.com.br` | não (repo do site) |
| **SISTEMA — HML** | `hml.app.sinery.com.br` | ✅ sim |
| **SISTEMA — PRD** | `app.sinery.com.br` | ✅ sim |

HML e PRD são **dois projetos Vercel separados** ligados ao **mesmo** repositório,
com **bancos diferentes** e **`AUTH_SECRET` diferentes**.

## Projeto SITE (separado)

- Domínios: `sinery.com.br`, `www.sinery.com.br`.
- Envs do site: apenas a URL do sistema (ex.: `NEXT_PUBLIC_SINERY_API=https://app.sinery.com.br`
  em produção, `https://hml.app.sinery.com.br` no ambiente de teste do site).
- **NUNCA** coloque `ASAAS_API_KEY`/`RESEND_API_KEY` no site — ele só chama a API do sistema.

## Projeto SISTEMA (este repositório)

### Domínios
- `hml.app.sinery.com.br` — HML/homologação (projeto Vercel de HML).
- `app.sinery.com.br` — produção (projeto Vercel de PRD).
- `{slug}.app.sinery.com.br` — tenants (subdomínio da clínica).

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

### Como preencher as envs na Vercel

1. **Crie o projeto HML** (import do repositório) e, separadamente, o **projeto PRD**.
2. Em cada projeto: **Settings → Environment Variables**.
3. Abra o `*.example` do ambiente como **lista de nomes**:
   - HML → `.env.staging.example` (`APP_ENV=staging`, domínio `hml.app.sinery.com.br`).
   - PRD → `.env.production.example` (`APP_ENV=production`, domínio `app.sinery.com.br`).
4. Para cada nome, **cole o valor real** (buscar/gerar conforme a tabela em
   [environment-variables.md](./environment-variables.md) → "Onde obter × o que gerar").
5. Bancos (`DATABASE_URL`) e `AUTH_SECRET` **diferentes** entre HML e PRD.
6. **Não** cole segredos em docs, chat ou nos `*.example`.

> Os arquivos `.env.staging.local` / `.env.production.local` são **opcionais e locais**
> (para rodar aquele ambiente na sua máquina). **A Vercel não lê esses arquivos** — em
> HML/PRD, tudo vem do painel. Rode `npm run env:check` local para conferir o que falta
> **por nome** antes de subir.

Mínimo por ambiente: `APP_ENV`, `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
`APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN`, `DEFAULT_TENANT_SLUG`, + Sentry + (quando reais)
Resend/Asaas/WhatsApp/OpenAI.

### Seed
- **Produção:** NÃO rodar seed (é bloqueado por `NODE_ENV=production`).
- **Staging:** rode `npm run db:seed` **manualmente** só se quiser os dados de
  demonstração (ou crie founder+planos por um seed controlado — ver
  [database-staging.md](./database-staging.md)). Nunca no build automático.

### Commit/versão
A Vercel expõe `VERCEL_GIT_COMMIT_SHA` — o `/api/health/deep` e o `/status` mostram
o commit curto + `APP_ENV` + versão.
