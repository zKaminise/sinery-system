# Variáveis de ambiente — Sinery System

Referência completa das variáveis usadas pelo Sinery System, separadas por
ambiente. **Nunca** coloque valores reais neste arquivo nem no `.env.example` —
apenas em `.env` (local) ou no gerenciador de segredos do provedor (staging/prod).

Regras de ouro:

- **`NEXT_PUBLIC_*` vai para o navegador.** Nunca use esse prefixo em um segredo
  (token, senha, connection string, app secret).
- **Segredos só no servidor**: `AUTH_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`,
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
  `SENTRY_AUTH_TOKEN`.
- `.env*` está no `.gitignore` — não comite `.env`.

> Legenda: ✅ obrigatória · ⚪ opcional · 🔒 segredo (server-only)

---

## 1. Obrigatórias em TODOS os ambientes

| Variável | Tipo | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ 🔒 | Connection string PostgreSQL. |
| `AUTH_SECRET` | ✅ 🔒 | Chave que assina o JWT de sessão (jose). Gere com `openssl rand -base64 32`. **Em produção o app se recusa a subir com o placeholder `change-me-in-development` ou com menos de 32 caracteres** (`lib/auth-secret.ts`). |
| `DEFAULT_TENANT_SLUG` | ✅ | Slug da clínica usada como fallback quando não há usuário logado. Deve existir em `Clinic.slug`. |

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
