# Vercel — staging & produção — Prompt 23

## Topologia de projetos Vercel

Três projetos Vercel possíveis, cada um com **Environment Variables próprias**:

| Projeto | Domínio(s) | Production branch (Git Flow) | Aponta p/ este repo? |
|---|---|---|---|
| **SITE** (institucional) | `sinery.com.br`, `www.sinery.com.br` | — | não (repo do site) |
| **SISTEMA — HML** | `hml.app.sinery.com.br` | **`develop`** | ✅ sim |
| **SISTEMA — PRD** | `app.sinery.com.br` | **`main`** | ✅ sim |

HML e PRD são **dois projetos Vercel separados** ligados ao **mesmo** repositório,
com **bancos diferentes** e **`AUTH_SECRET` diferentes**.

**Git Flow (ver [git-flow.md](./git-flow.md)):** no projeto Vercel **HML**, configure
Settings → Git → **Production Branch = `develop`**; no projeto **PRD**, Production
Branch = `main`. Assim, merge em `develop` publica HML e merge em `main` publica PRD,
usando o mesmo GitHub repo com envs/bancos separados por projeto.

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

#### Wildcard de clínica (Prompt 27)

Cada projeto precisa de **dois** domínios: a raiz **e** o wildcard.

| Projeto | Domínios a adicionar na Vercel | DNS |
|---|---|---|
| **HML** | `hml.app.sinery.com.br` **+** `*.hml.app.sinery.com.br` | CNAME `*.hml.app` → Vercel |
| **PRD** | `app.sinery.com.br` **+** `*.app.sinery.com.br` | CNAME `*.app` → Vercel |

- Adicionar o **wildcard** faz a Vercel emitir um certificado TLS que cobre
  qualquer `{slug}` — **não** é preciso criar um domínio/DNS por clínica. Criar
  clínica no Founder **não** cria DNS; o wildcard resolve todos os slugs e o
  código resolve o slug pelo host.
- **HML já está com o wildcard `*.hml.app.sinery.com.br` validado/funcional na Vercel**
  → no projeto **HML** defina `TENANT_SUBDOMAIN_ENFORCED=true` (login de clínica só
  no subdomínio; a raiz mostra a tela "acesse pelo endereço da sua clínica"). Em
  **PRD**, ligue para `true` só depois de validar `*.app.sinery.com.br` (senão
  mantenha `false` transitoriamente). Passo a passo (9 passos) em
  [domains-and-dns.md](./domains-and-dns.md#checklist-de-wildcard-9-passos).
- **Não** remova registros de e-mail (MX/SPF/DKIM/DMARC do Resend) nem do provedor
  de DNS (ex.: Umbler) ao adicionar o wildcard — é aditivo.

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

> As "colas" locais `.env.staging.local` (HML) e `.env.prd.local` (PRD) são **opcionais**
> e servem só para você copiar os valores para o painel. **A Vercel não lê esses
> arquivos** — em HML/PRD tudo vem do painel.
>
> ⚠️ Use **`.env.prd.local`** para produção, **nunca `.env.production.local`**: o
> `next build` (NODE_ENV=production) carrega `.env.production.local` automaticamente e
> seu build LOCAL passaria a apontar para o banco de produção. Confira o readiness de
> HML/PRD pelo `GET /api/health/deep` já no ambiente deployado (não pelo `env:check`,
> que valida só a sua máquina).

Mínimo por ambiente: `APP_ENV`, `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
`APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN`, `DEFAULT_TENANT_SLUG`, `TENANT_SUBDOMAIN_ENFORCED`,
+ Sentry + (quando reais) Resend/Asaas/WhatsApp/OpenAI.

> `TENANT_SUBDOMAIN_ENFORCED` (Prompt 27): **HML = `true`** (wildcard já validado);
> PRD = `true` após validar `*.app.sinery.com.br`. Ver [domains-and-dns.md](./domains-and-dns.md#segurança-multi-tenant-por-subdomínio-prompt-27).

### Seed
- **Produção:** NÃO rodar seed (é bloqueado por `NODE_ENV=production`).
- **Staging:** rode `npm run db:seed` **manualmente** só se quiser os dados de
  demonstração (ou crie founder+planos por um seed controlado — ver
  [database-staging.md](./database-staging.md)). Nunca no build automático.

### Commit/versão
A Vercel expõe `VERCEL_GIT_COMMIT_SHA` — o `/api/health/deep` e o `/status` mostram
o commit curto + `APP_ENV` + versão.
