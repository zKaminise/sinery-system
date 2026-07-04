# Sinery System — Checklist de release V1 (staging / produção)

Guia operacional para levar a V1 do Sinery System a **staging** e depois a um
**piloto em produção**. Escrito no fim do Prompt 20 (auditoria + hardening).

- Variáveis de ambiente: veja [environment-variables.md](./environment-variables.md).
- Autenticação: [authentication.md](./authentication.md) ·
  Observabilidade: [observability.md](./observability.md) ·
  WhatsApp: [whatsapp-webhook.md](./whatsapp-webhook.md),
  [whatsapp-send.md](./whatsapp-send.md),
  [whatsapp-assist-flow.md](./whatsapp-assist-flow.md).

---

## 1. Checklist LOCAL (dev)

- [ ] `npm install`
- [ ] `.env` criado a partir de `.env.example` com `DATABASE_URL` + `AUTH_SECRET`
- [ ] Banco de dev de pé (Docker `docker-compose.yml` ou `npx prisma dev`)
- [ ] `npm run db:push` (aplica o schema)
- [ ] `npm run db:seed` (clínica de demonstração `sorria-odonto`)
- [ ] `npm run dev` → login com OWNER
- [ ] `npm run test` · `npm run lint` · `npx tsc --noEmit` · `npm run build` passam

## 2. Banco de dados & migrations

**Hoje:** o projeto usa `prisma db push` (dev). **Não existe** `prisma/migrations`
ainda. `db:push` **não deve** ser usado em produção.

Scripts disponíveis (`package.json`):

- `db:push` — **DEV ONLY** (sincroniza schema sem migration).
- `db:migrate` — `prisma migrate dev` (cria migration em dev).
- `db:migrate:deploy` — `prisma migrate deploy` (**staging/produção**).
- `db:generate` — regenera o client.
- `db:seed` — dados de demonstração (guard de produção — ver §3).

**Plano para criar migrations reais (baseline) antes de staging:**

1. Em um ambiente **limpo** (banco vazio dedicado), rode `npm run db:migrate -- --name init`.
   Isso cria `prisma/migrations/<timestamp>_init` a partir do schema atual.
2. Confira o SQL gerado (índices, unique, `onDelete`).
3. Comite `prisma/migrations/`.
4. **Staging/produção:** `npm run db:migrate:deploy` (nunca `db:push`).
5. Se um banco de staging já tem o schema via `db:push`, faça o baseline com
   `prisma migrate resolve --applied <migration>` antes do primeiro `deploy`.

> ⚠️ Não gere a migration baseline contra um banco com dados reais sem revisar
> o SQL. Não force `db:reset` em produção (apaga tudo).

Checklist:

- [ ] Migration baseline `init` criada e revisada em ambiente limpo
- [ ] `prisma/migrations/` comitado
- [ ] Staging sobe com `db:migrate:deploy`
- [ ] `db:push` marcado como dev-only (feito nesta doc)

## 3. Seed por ambiente

- **Local / staging (demo):** `npm run db:seed` cria a clínica fake `sorria-odonto`
  com usuários de senha provisória `Sinery@123` + o **PlatformUser** dev
  `founder@sinery.local` / `Sinery@123` + planos/assinatura/faturas de demonstração.
- **Produção:** o seed **aborta** se `NODE_ENV=production` (guard em
  `prisma/seed.ts`). Para forçar em staging use `SEED_ALLOW_PRODUCTION=true`.
- [ ] Produção **não** roda o seed de demonstração
- [ ] Clínica/usuário reais criados por processo próprio (não pelo seed fake)
- [ ] **Founder de produção criado manualmente** (não usar `founder@sinery.local`):
      gere o hash e insira um `PlatformUser` FOUNDER real com senha forte. Ver
      [docs/founder-admin.md](./founder-admin.md).

## 4. Segurança

- [ ] `AUTH_SECRET` real (≥32 chars) em staging/produção — o boot falha com placeholder
- [ ] Cookies de sessão `httpOnly` + `secure` (automático com `NODE_ENV=production`) + `sameSite=lax`
- [ ] Headers de segurança ativos (X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy; HSTS em produção) — `next.config.ts`
- [ ] HTTPS forçado no provedor (TLS)
- [ ] Nenhum segredo em `NEXT_PUBLIC_*`
- [ ] Multi-tenant: toda query escopada por `clinicId` da sessão (auditado no Prompt 20)
- [ ] Permissões validadas no servidor (`requireApiUser` em todas as rotas de dados)
- [ ] PROFESSIONAL continua somente-leitura; RECEPTIONIST sem configurações sensíveis
- [ ] Não é possível inativar o último OWNER nem a si mesmo

> Riscos conhecidos aceitos para o piloto (ver §16): sem rate-limit de brute-force
> no login; sem CSP estrita; `changePassword` não pede a senha atual (fluxo de
> senha provisória). Mitigações planejadas fora da V1.

## 5. WhatsApp

- [ ] Webhook GET (handshake) validado com `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- [ ] `WHATSAPP_VERIFY_SIGNATURE=true` (assinatura HMAC via `WHATSAPP_APP_SECRET`)
- [ ] Clínica resolvida por `phoneNumberId` (nunca pelo frontend)
- [ ] Piloto começa com `WHATSAPP_SEND_MOCK_MODE=true` e `WHATSAPP_AUTO_PROCESS_ASSIST=false`
- [ ] Só ligar envio real / auto-Assist após validar em staging
- [ ] `WHATSAPP_REQUIRE_24H_WINDOW=true`
- [ ] Nenhum token da Meta em UI/log/auditoria

## 6. OpenAI / Sinery Assist

- [ ] `ASSIST_USE_REAL_AI=false` (ou `mock`) até decidir ligar IA real
- [ ] `OPENAI_API_KEY` só no servidor
- [ ] Kill switch `ASSIST_GLOBAL_DISABLED` conhecido pela operação
- [ ] Rate limits e `ASSIST_DAILY_TOKEN_LIMIT` revisados
- [ ] Mensagens sensíveis → transferência humana (validado)

## 6.1 E-mail (Resend) + pagamento (Asaas) — Prompt 22

- [ ] **Resend:** domínio `sinery.com.br` verificado (SPF/DKIM); `RESEND_API_KEY`
      real; `EMAIL_MOCK_MODE=false` só quando quiser enviar de verdade. From
      `no-reply@sinery.com.br`, reply-to `kaminise@sinery.com.br`.
- [ ] Recuperação de senha testada (código 6 dígitos, 10 min, uso único).
- [ ] **Asaas:** começar em sandbox (`ASAAS_ENVIRONMENT=sandbox`,
      `ASAAS_MOCK_MODE=false`, chave sandbox). Só ir para `production` após validar.
- [ ] `ASAAS_WEBHOOK_TOKEN` definido (≠ da API key) e webhook cadastrado no painel
      Asaas apontando para `/api/webhooks/asaas`.
- [ ] `PUBLIC_CHECKOUT_ENABLED=true` + `PUBLIC_CHECKOUT_ALLOWED_ORIGIN` = domínio do
      site, só quando o site estiver pronto.
- [ ] Confirmado: clínica só é criada **após pagamento confirmado**; webhook
      idempotente (pagamento 2x não duplica clínica).
- [ ] Chaves (Resend/Asaas) **só no servidor** — nunca em `NEXT_PUBLIC_*`/logs/bundle.

## 7. Observabilidade / logs

- [ ] `SENTRY_DSN` configurado (recomendado em staging/prod)
- [ ] `/status` e `/api/health/deep` acessíveis para monitor (UptimeRobot em `/api/health`)
- [ ] AuditLog não grava conteúdo de mensagem/prompt/token (auditado)
- [ ] Logs técnicos redijem chaves sensíveis (`lib/logger.ts`)

## 8. Backups

- [ ] Backup automático do Postgres habilitado no provedor
- [ ] Teste de restore documentado
- [ ] Retenção definida (ex: 7–30 dias)

## 9. Testes manuais obrigatórios (mock)

Ver a lista completa na Parte 17 do Prompt 20. Resumo:

- [ ] Login/logout/login novamente; menu de perfil sem erro
- [ ] CRUD paciente / profissional / serviço; agenda manual (conflito bloqueia)
- [ ] Conversa INTERNAL_SIMULATOR; `/assist` e `/assist/uso`
- [ ] WhatsApp mock: inbound → Assist responde → "1" agenda → humano assume →
      Assist para → devolve → Assist volta
- [ ] Mensagem sensível transfere; prompt injection recusado; janela 24h
- [ ] PROFESSIONAL bloqueado; RECEPTIONIST limitado; `/auditoria`, `/status`

## 10. Gates automatizados

- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

## 11. Plano de rollback

- [ ] Deploy anterior identificado (tag/commit) e redeployável
- [ ] Migrations: só usar migrations aditivas; evitar `DROP` na V1. Rollback de
      schema = restaurar backup (não há down-migrations garantidas)
- [ ] Feature flags de risco desligáveis sem deploy: `ASSIST_GLOBAL_DISABLED`,
      `WHATSAPP_AUTO_PROCESS_ASSIST`, `WHATSAPP_SEND_MESSAGES_ENABLED`,
      `ASSIST_USE_REAL_AI`

## 12. Critérios para LIBERAR o piloto

- [ ] Todos os gates (§10) verdes
- [ ] Testes manuais (§9) ok
- [ ] `AUTH_SECRET` real; HTTPS; backups ligados
- [ ] Multi-tenant e permissões auditados sem vazamento
- [ ] Cliente ciente de: WhatsApp em mock/limitado, IA opcional, sem pagamento

## 13. Critérios para NÃO liberar

- [ ] Qualquer vazamento cross-tenant
- [ ] Segredo exposto em bundle/log/auditoria
- [ ] Endpoint de dados sem `requireApiUser`
- [ ] `AUTH_SECRET` placeholder em produção
- [ ] Envio WhatsApp real sem validar janela/assinatura
- [ ] Gates falhando

## 14. Riscos conhecidos (V1)

| Risco | Severidade | Mitigação atual | Plano |
|---|---|---|---|
| Webhook WhatsApp síncrono (sem fila) | Médio | timeout + try/catch, sempre 200 | worker/fila pós-V1 |
| Sem rate-limit de brute-force no login | Médio | senha forte + audit de falhas | rate-limit/lockout pós-V1 |
| Sem CSP estrita | Baixo | X-Frame-Options + nosniff | CSP com nonce pós-V1 |
| `changePassword` não pede senha atual | Baixo | fluxo de senha provisória | exigir senha atual para troca voluntária |
| Sem migrations versionadas ainda | Médio | schema estável via `db:push` | baseline `init` antes de staging (§2) |
| Login não seleciona clínica (e-mail único) | Baixo | 1 clínica por e-mail na prática | seleção de tenant multi-clínica pós-V1 |

## 15. NÃO implementado na V1 (fora de escopo)

Templates WhatsApp (HSM), mídia/áudio/documentos/botões/interativos, Google
Calendar, pagamento (Sinery Pay), realtime/websocket, fila externa/Redis,
retry/DLQ, e-mail (Resend), supervisão avançada de IA / evals.
