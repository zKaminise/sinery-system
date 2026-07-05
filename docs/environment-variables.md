# Variáveis de ambiente — Sinery System

Referência completa das variáveis usadas pelo Sinery System, separadas por
ambiente. **Nunca** coloque valores reais neste arquivo nem em nenhum `*.example` —
apenas nos arquivos `*.local` (não versionados) ou no gerenciador de segredos do
provedor (Vercel → Environment Variables).

## Padrão de arquivos `.env` (local / HML / produção)

O projeto separa os ambientes assim:

| Arquivo | Commitado? | Para quê |
|---|---|---|
| `.env.example` | ✅ sim | Índice/template universal (esta referência em forma de arquivo). |
| `.env.local.example` | ✅ sim | Template com valores **seguros/fakes** de desenvolvimento local. |
| `.env.staging.example` | ✅ sim | Template com **placeholders** de HML. |
| `.env.production.example` | ✅ sim | Template com **placeholders** de produção. |
| `.env` / `.env.local` | ❌ nunca | Desenvolvimento local real (Docker na porta 5544). |
| `.env.staging.local` | ❌ nunca | "Cola" de HML para colar na Vercel. **A Vercel NÃO lê este arquivo.** |
| `.env.prd.local` | ❌ nunca | "Cola" de produção para colar na Vercel. **A Vercel NÃO lê este arquivo.** |

> ⚠️ **Cuidado com o nome `.env.production.local`**: `next build` roda com
> `NODE_ENV=production` e **carrega `.env.production.local` automaticamente**. Se você
> puser o `DATABASE_URL` real de produção nesse arquivo, o **build local** vai apontar
> para o banco de produção. Por isso a "cola" de produção usa **`.env.prd.local`**
> (que o Next NÃO carrega, mas continua no `.gitignore` via `.env*.local`). O banco e
> segredos reais de produção vivem só na Vercel.

- **Local**: `cp .env.local.example .env.local` e ajuste. O Next carrega `.env.local`
  e `.env` automaticamente.
- **HML/Produção na Vercel**: as variáveis vêm do **painel** (Environment Variables),
  não de arquivos `.local`. Use os `*.example` só como lista de nomes.
- **`APP_ENV` é a fonte de verdade do ambiente funcional** (`local` | `staging` | `production`),
  não o `NODE_ENV` — a Vercel usa `NODE_ENV=production` até em builds de HML. Veja
  [`docs/deploy-staging.md`](deploy-staging.md) e [`docs/vercel-staging.md`](vercel-staging.md).
- Valide o ambiente atual com `npm run env:check` (mostra o que falta **por nome**, nunca valores).

Regras de ouro:

- **`NEXT_PUBLIC_*` vai para o navegador.** Nunca use esse prefixo em um segredo
  (token, senha, connection string, app secret).
- **Segredos só no servidor**: `AUTH_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`,
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
  `SENTRY_AUTH_TOKEN`, `RESEND_API_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`,
  `PLATFORM_FOUNDER_TEMP_PASSWORD`.
- `.gitignore` ignora os `.env*` reais e libera só os `*.example` — não comite segredos.

> Legenda: ✅ obrigatória · ⚪ opcional · 🔒 segredo (server-only)

---

## 1. Obrigatórias em TODOS os ambientes

| Variável | Tipo | Descrição |
|---|---|---|
| `APP_ENV` | ✅ | Ambiente funcional: `local` \| `staging` (ou `hml`) \| `production`. **Fonte de verdade** do readiness (`lib/env/env-readiness.ts`), independente de `NODE_ENV`. `SINERY_ENV` é um alias aceito com precedência. |
| `DATABASE_URL` | ✅ 🔒 | Connection string PostgreSQL. Local: Docker (porta 5544). HML/PRD: Neon (`?sslmode=require`), **bancos separados por ambiente**. |
| `AUTH_SECRET` | ✅ 🔒 | Chave que assina o JWT de sessão (jose). Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` (ou `openssl rand -base64 32`). **Único por ambiente** (HML ≠ PRD). **Em produção/staging o app se recusa a subir com placeholder ou < 32 caracteres** (`lib/auth-secret.ts`). |
| `DEFAULT_TENANT_SLUG` | ✅/⚪ | Slug da clínica usada como fallback quando não há usuário logado. Local: `sorria-odonto`. HML/PRD: normalmente vazio. |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | ✅ | URL pública do app. Local `http://localhost:3000`; HML `https://hml.app.sinery.com.br`; PRD `https://app.sinery.com.br`. `APP_URL` é o equivalente server-side (não exposto ao bundle). |
| `PLATFORM_FOUNDER_EMAIL` | ⚪ | E-mail do Founder criado pelo seed/bootstrap (fallback `founder@sinery.local`). |
| `PLATFORM_FOUNDER_TEMP_PASSWORD` | ⚪ 🔒 | Senha provisória do Founder **só para o primeiro bootstrap**. A conta nasce `temporaryPassword: true` (troca no 1º login). **Rotacione/remova depois em produção.** |

## 2. Recomendadas / com padrão seguro

| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `SESSION_COOKIE_NAME` | ⚪ | `sinery_session` | Nome do cookie de sessão da clínica (httpOnly). |
| `SESSION_MAX_AGE_SECONDS` | ⚪ | `604800` (7d) | Validade da sessão da clínica. |
| `SESSION_PLATFORM_COOKIE_NAME` | ⚪ | `sinery_platform_session` | Cookie da sessão do painel Founder (`/founder`), separada da clínica. |
| `SESSION_PLATFORM_MAX_AGE_SECONDS` | ⚪ | `86400` (1d) | Validade da sessão do Founder. |
| `NEXT_PUBLIC_APP_URL` | ⚪ | `http://localhost:3000` | URL pública, usada em links absolutos (não é segredo). |
| `NEXT_PUBLIC_ROOT_DOMAIN` | ⚪ | `localhost:3000` | Domínio raiz para resolver subdomínio da clínica (não é segredo). |

## 3. Observabilidade (Sentry) — todas ⚪

Deixe vazias para rodar sem captura de erros (nada quebra).

| Variável | Tipo | Descrição |
|---|---|---|
| `SENTRY_DSN` | ⚪ 🔒* | DSN server-side. Sem ela, Sentry não inicializa. |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚪ | DSN client-side (DSN não é secreto, mas é exposto ao bundle — ok). |
| `SENTRY_AUTH_TOKEN` | ⚪ 🔒 | Só para upload de source maps em CI. |
| `SENTRY_ORG` / `SENTRY_PROJECT` | ⚪ | Metadados de build. |

\* DSN não é um segredo forte, mas mantenha o server-side fora de `NEXT_PUBLIC`.

## 4. Sinery Assist / OpenAI — todas ⚪

Com `OPENAI_API_KEY` vazio **ou** `ASSIST_USE_REAL_AI=false`, a Assist roda no
modo determinístico baseado em regras (Prompt 12). Nada quebra.

| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `OPENAI_API_KEY` | ⚪ 🔒 | vazio | Chave OpenAI. `"mock"` roda o caminho de IA offline (sem custo). |
| `OPENAI_MODEL` | ⚪ | `gpt-4o-mini` | Modelo de chat. |
| `OPENAI_TIMEOUT_MS` | ⚪ | `20000` | Timeout por requisição. |
| `OPENAI_MAX_OUTPUT_TOKENS` | ⚪ | `800` | Máx. tokens de saída. |
| `ASSIST_USE_REAL_AI` | ⚪ | `false` | Chave-mestra da IA real. |
| `ASSIST_DAILY_TOKEN_LIMIT` | ⚪ | `100000` | Orçamento de tokens/clínica/dia. |
| `ASSIST_MAX_HISTORY_MESSAGES` | ⚪ | `20` | Histórico enviado ao modelo. |
| `ASSIST_GLOBAL_DISABLED` | ⚪ | `false` | Kill switch global (desliga toda automação). |
| `ASSIST_RATE_LIMIT_PER_MINUTE` | ⚪ | `20` | Rate limit por clínica/min. |
| `ASSIST_RATE_LIMIT_PER_DAY` | ⚪ | `1000` | Rate limit por clínica/dia. |
| `ASSIST_CONVERSATION_RATE_LIMIT_PER_MINUTE` | ⚪ | `10` | Rate limit por conversa/min. |
| `ASSIST_TOOL_RATE_LIMIT_PER_MINUTE` | ⚪ | `30` | Rate limit de tools/min. |
| `ASSIST_MAX_TOOLS_PER_TURN` | ⚪ | `3` | Loop guard de tools por turno. |

## 5. WhatsApp Cloud API — todas ⚪ (secretos marcados 🔒)

Com tudo vazio a integração fica "não configurada" e o app roda normalmente.

| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `WHATSAPP_CLOUD_API_ENABLED` | ⚪ | `false` | Liga a integração. |
| `WHATSAPP_GRAPH_API_VERSION` | ⚪ | `v20.0` | Versão da Graph API. |
| `WHATSAPP_ACCESS_TOKEN` | ⚪ 🔒 | vazio | Token da Graph API. **Server-only, nunca logado/gravado.** |
| `WHATSAPP_PHONE_NUMBER_ID` | ⚪ | vazio | Resolve a clínica (webhook). Não secreto, mostrado mascarado. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ⚪ | vazio | Metadado. |
| `WHATSAPP_APP_ID` | ⚪ | vazio | Metadado. |
| `WHATSAPP_APP_SECRET` | ⚪ 🔒 | vazio | Valida assinatura HMAC do webhook. **Server-only.** |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ⚪ 🔒 | vazio | Handshake do webhook. **Server-only, nunca ecoado.** |
| `WHATSAPP_WEBHOOK_PATH` | ⚪ | `/api/webhooks/whatsapp` | Caminho do webhook. |
| `WHATSAPP_WEBHOOK_ENABLED` | ⚪ | `false` | Liga GET/POST do webhook. |
| `WHATSAPP_VERIFY_SIGNATURE` | ⚪ | `true` | Valida `X-Hub-Signature-256`. **Mantenha `true` fora de dev.** |
| `WHATSAPP_SEND_MESSAGES_ENABLED` | ⚪ | `false` | Habilita envio (real/mock). |
| `WHATSAPP_SEND_MOCK_MODE` | ⚪ | `false` | Envio mock (sem Graph). |
| `WHATSAPP_SEND_TIMEOUT_MS` | ⚪ | `15000` | Timeout de envio. |
| `WHATSAPP_REQUIRE_24H_WINDOW` | ⚪ | `true` | Exige janela de 24h. **Mantenha `true`.** |
| `WHATSAPP_AUTO_CREATE_PATIENT` | ⚪ | `false` | Criar paciente de número desconhecido. |
| `WHATSAPP_AUTO_PROCESS_ASSIST` | ⚪ | `false` | Aciona a Assist em inbound. **Mantenha `false` em produção até validar.** |
| `WHATSAPP_ASSIST_REPLY_ENABLED` | ⚪ | `false` | Permite ENVIAR a resposta da Assist. |
| `WHATSAPP_ASSIST_MOCK_MODE_ALLOWED` | ⚪ | `true` | Permite mock nas respostas da Assist. |
| `WHATSAPP_ASSIST_MAX_AUTO_REPLIES_PER_CONVERSATION_PER_HOUR` | ⚪ | `20` | Anti-flood. |
| `WHATSAPP_ASSIST_MAX_AUTO_REPLIES_PER_INBOUND` | ⚪ | `1` | Máx. respostas por inbound. |
| `WHATSAPP_ASSIST_PROCESSING_TIMEOUT_MS` | ⚪ | `20000` | Timeout do processamento no webhook. |
| `WHATSAPP_ALLOW_CONFIG_LIVE_CHECK` | ⚪ | `false` | Check read-only na Graph (mantenha `false`). |

## 6. Seed / operação

| Variável | Tipo | Descrição |
|---|---|---|
| `SEED_ALLOW_PRODUCTION` | ⚪ | Necessária para `db:seed` rodar com `NODE_ENV=production` (o seed cria dados de demonstração e por padrão se recusa a rodar em produção). Use só em staging com dados de demo. |
| `NODE_ENV` | (auto) | `production` ativa: cookie `secure`, HSTS, guard do `AUTH_SECRET` e guard do seed. |

## 7. E-mail transacional (Resend) — Prompt 22

| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `RESEND_API_KEY` | ⚪ 🔒 | vazio | Chave Resend. **Server-only.** Vazio → mock. |
| `RESEND_FROM_EMAIL` | ⚪ | `Sinery <no-reply@sinery.com.br>` | Remetente (via Resend; não precisa ser caixa real). |
| `RESEND_REPLY_TO_EMAIL` | ⚪ | `kaminise@sinery.com.br` | Reply-to (e-mail real). |
| `RESEND_CONTACT_TO_EMAIL` | ⚪ | `kaminise@sinery.com.br` | Destino do form de contato (futuro). |
| `EMAIL_MOCK_MODE` | ⚪ | `true` | `true` não envia (EmailLog MOCKED). `false` envia. |

## 8. Recuperação de senha — Prompt 22

| Variável | Tipo | Padrão |
|---|---|---|
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | ⚪ | `10` |
| `PASSWORD_RESET_MAX_ATTEMPTS` | ⚪ | `5` |
| `PASSWORD_RESET_CODE_LENGTH` | ⚪ | `6` |
| `PASSWORD_RESET_RESEND_COOLDOWN_SECONDS` | ⚪ | `60` |

## 9. Pagamento (Asaas) + checkout público — Prompt 22

| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `ASAAS_ENABLED` | ⚪ | `false` | Liga a integração. |
| `ASAAS_MOCK_MODE` | ⚪ | `true` | `true` simula (sem chamar o Asaas). |
| `ASAAS_ENVIRONMENT` | ⚪ | `sandbox` | `sandbox` \| `production`. |
| `ASAAS_API_KEY` | ⚪ 🔒 | vazio | Chave Asaas. **Server-only.** |
| `ASAAS_BASE_URL_SANDBOX` / `ASAAS_BASE_URL_PRODUCTION` | ⚪ | urls padrão | Base URLs. |
| `ASAAS_WEBHOOK_TOKEN` | ⚪ 🔒 | vazio | Validado no header `asaas-access-token`. **≠ da API key.** |
| `ASAAS_CHECKOUT_SUCCESS_URL` / `ASAAS_CHECKOUT_CANCEL_URL` | ⚪ | vazio | URLs de retorno (futuro). |
| `PUBLIC_CHECKOUT_ENABLED` | ⚪ | `false` | Liga o endpoint público de checkout. |
| `PUBLIC_CHECKOUT_ALLOWED_ORIGIN` | ⚪ | vazio | Origin CORS do site (ex.: `https://sinery.com.br`). |
| `PUBLIC_CHECKOUT_RATE_LIMIT_PER_HOUR` | ⚪ | `20` | Rate limit por e-mail. |

> Real só quando: e-mail `EMAIL_MOCK_MODE=false` + `RESEND_API_KEY`; Asaas
> `ASAAS_ENABLED=true` + `ASAAS_MOCK_MODE=false` + `ASAAS_API_KEY`.

## 9b. Mensageria: provider + Evolution API — Prompt 24

Provider por clínica: **Meta Cloud API** (produção) ou **Evolution API** (HML/testes).
Evolution é **bloqueada em produção** por padrão (o readiness gera critical issue).

| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `MESSAGING_PROVIDER` | ⚪ | `meta_cloud` | `meta_cloud` \| `evolution`. Provider padrão do ambiente. |
| `EVOLUTION_API_ENABLED` | ⚪ | `false` | Liga a integração Evolution. |
| `EVOLUTION_API_URL` | ⚪ | vazio | URL base da Evolution API. |
| `EVOLUTION_API_KEY` | ⚪ 🔒 | vazio | Chave da Evolution (header `apikey`). **Server-only.** |
| `EVOLUTION_INSTANCE_NAME` | ⚪ | vazio | Nome da instância; resolve **uma única clínica**. |
| `EVOLUTION_WEBHOOK_SECRET` | ⚪ 🔒 | vazio | Segredo do webhook (header `x-sinery-evolution-secret` ou `?token=`). **Server-only.** |
| `EVOLUTION_WEBHOOK_PATH` | ⚪ | `/api/webhooks/evolution` | Caminho do webhook. |
| `EVOLUTION_WEBHOOK_ENABLED` | ⚪ | `false` | Liga o POST do webhook. |
| `EVOLUTION_SEND_MESSAGES_ENABLED` | ⚪ | `false` | Habilita envio (real/mock). |
| `EVOLUTION_SEND_MOCK_MODE` | ⚪ | `true` | `true` simula o envio (mock id `mock_evolution_…`) sem chamar a API. |
| `EVOLUTION_AUTO_PROCESS_ASSIST` | ⚪ | `false` | Aciona a Assist em inbound Evolution (AI_HANDLING). |
| `EVOLUTION_ASSIST_REPLY_ENABLED` | ⚪ | `false` | Permite ENVIAR a resposta da Assist pela Evolution. |
| `EVOLUTION_PROCESSING_TIMEOUT_MS` | ⚪ | `20000` | Timeout do processamento/envio. |
| `EVOLUTION_ALLOW_IN_PRODUCTION` | ⚪ | `false` | **Não** ligar em produção (gera critical warning se `true`). |

> Webhook em HML: `https://hml.app.sinery.com.br/api/webhooks/evolution?token=<EVOLUTION_WEBHOOK_SECRET>`.
> `EVOLUTION_API_KEY` e `EVOLUTION_WEBHOOK_SECRET` **nunca** vão para o client. Ver [evolution-api-hml.md](./evolution-api-hml.md).

## 10. Futuras (ainda NÃO usadas no código)

| Variável | Para |
|---|---|
| (nenhuma pendente) | Nota fiscal / cupons / cobrança por uso — não modelados. |

---

## Diferenças por ambiente (resumo)

| | Local | Staging | Produção |
|---|---|---|---|
| `DATABASE_URL` | Docker/Prisma dev | Postgres gerenciado | Postgres gerenciado |
| `AUTH_SECRET` | qualquer valor | **real (≥32)** | **real (≥32)** |
| `NODE_ENV` | development | production | production |
| Sentry | opcional (vazio) | recomendado | recomendado |
| `WHATSAPP_SEND_MOCK_MODE` | `true` | `true` (piloto) | `false` |
| `ASSIST_USE_REAL_AI` | `false`/`mock` | conforme teste | conforme decisão |
| Seed | `db:seed` livre | `SEED_ALLOW_PRODUCTION=true` p/ demo | **não rodar seed fake** |

---

## Onde obter × o que gerar manualmente

| Variável | Como conseguir | Segredo? | `NEXT_PUBLIC`? |
|---|---|---|---|
| `DATABASE_URL` | **Buscar**: painel do Neon → Connection string (branch HML e branch PRD separadas). | 🔒 | não |
| `AUTH_SECRET` | **Gerar**: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Um por ambiente. | 🔒 | não |
| `RESEND_API_KEY` | **Buscar**: dashboard Resend → API Keys. | 🔒 | não |
| `ASAAS_API_KEY` | **Buscar**: painel Asaas → Integrações → API Key (sandbox vs produção). | 🔒 | não |
| `ASAAS_WEBHOOK_TOKEN` | **Gerar**: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`; cole o mesmo valor no webhook do Asaas. | 🔒 | não |
| `OPENAI_API_KEY` | **Buscar**: platform.openai.com → API Keys. | 🔒 | não |
| `WHATSAPP_ACCESS_TOKEN` / `_APP_SECRET` / `_PHONE_NUMBER_ID` / `_BUSINESS_ACCOUNT_ID` / `_APP_ID` | **Buscar**: Meta for Developers (WhatsApp Cloud API). | 🔒 (token/secret) | não |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **Gerar**: string aleatória; use a mesma no painel da Meta. | 🔒 | não |
| `PLATFORM_FOUNDER_TEMP_PASSWORD` | **Gerar**: senha forte só p/ bootstrap; troque no 1º login e remova. | 🔒 | não |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | **Buscar**: Sentry → Project Settings → Client Keys (DSN). | DSN não é forte | só o `NEXT_PUBLIC_` |
| `APP_ENV`, `NEXT_PUBLIC_APP_URL`, `APP_URL`, domínios, flags de mock | **Definir manualmente** conforme o ambiente (ver `*.example`). | não | as `NEXT_PUBLIC_*` sim |

### Como preencher as envs na Vercel

1. Crie **um projeto Vercel para HML** e **outro para PRD**, ambos apontando para este repositório.
2. Em cada projeto: **Settings → Environment Variables**.
3. Copie os **nomes** do `.env.staging.example` (HML) ou `.env.production.example` (PRD).
4. Preencha os **valores reais** (buscar/gerar conforme a tabela acima) — cada projeto tem envs próprias.
5. Garanta `APP_ENV=staging` no projeto HML e `APP_ENV=production` no projeto PRD.
6. Bancos e `AUTH_SECRET` **diferentes** entre HML e PRD.
7. **Nunca** cole segredos em docs, chat ou nos arquivos `*.example`.
8. `npm run env:check` valida o env **da sua máquina** (`.env.local`/`.env`, sempre `local`). Para conferir HML/PRD, use o `GET /api/health/deep` (bloco `readiness`) já no ambiente deployado.
