# Plano de teste — staging — Prompt 23

## A. Local (antes de subir)

```bash
npm install
npm run db:generate
npm run db:push        # dev
npm run db:seed
npm run test           # 186 testes
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```
Abrir: `/founder`, `/login`, `/esqueci-senha`, `/status`, `/api/health/deep`.
Testar checkout mock + webhook Asaas mock (ver [asaas-integration.md](./asaas-integration.md)).

## B. Staging com MOCK

`APP_ENV=staging`, `EMAIL_MOCK_MODE=true`, `ASAAS_ENABLED=true`,
`ASAAS_MOCK_MODE=true`, `PUBLIC_CHECKOUT_ENABLED=true`, WhatsApp/OpenAI mock/false.

1. `GET /status`, `/api/health` (200), `/api/health/deep` (readyForStaging=true).
2. Login founder → criar clínica manual.
3. Login OWNER da clínica → dashboard.
4. Recuperação de senha (código no log dev, ou Resend real se configurado).
5. CRUD paciente / profissional / serviço; agenda manual (conflito bloqueia).
6. Conversa INTERNAL_SIMULATOR; Assist rule-based.
7. WhatsApp mock; humano assume/devolve Assist.
8. Checkout público mock → webhook Asaas mock → provisionamento → e-mail welcome (MOCKED).
9. Reenviar mesmo webhook → não duplica.
10. Suspender/liberar clínica; ver `/auditoria`.
11. `/founder/checkouts`, `/founder/emails`.

## C. Staging com serviços reais/sandbox

1. **Resend real:** `EMAIL_MOCK_MODE=false` + `RESEND_API_KEY` + domínio verificado.
   Recuperação de senha com e-mail próprio → confirmar recebimento, from
   `no-reply@sinery.com.br`, reply-to `kaminise@sinery.com.br`.
2. **Asaas sandbox:** `ASAAS_MOCK_MODE=false` + chave sandbox + webhook cadastrado
   no painel Asaas (`/api/webhooks/asaas` + `ASAAS_WEBHOOK_TOKEN`). Checkout →
   pagamento de teste → webhook → provisionamento.
3. **WhatsApp real:** só depois, com número de teste, `WHATSAPP_AUTO_PROCESS_ASSIST=false`.
4. **OpenAI real:** só depois, `ASSIST_USE_REAL_AI=true` com limites.

## D. Checklist quando staging estiver no ar

- [ ] `https://hml.app.sinery.com.br/status`
- [ ] `.../api/health` e `.../api/health/deep` (readiness ok, sem segredo)
- [ ] Login founder → criar clínica → login OWNER
- [ ] Recuperação de senha
- [ ] Checkout (mock/sandbox) → webhook → provisionamento → e-mail
- [ ] Suspensão/liberação · Auditoria · Assist · WhatsApp mock

## E. Antes de produção

- [ ] `readyForProduction=true` no `/api/health/deep`
- [ ] `AUTH_SECRET` real, mocks desligados, backups, migrations aplicadas
- [ ] Ver [v1-release-checklist.md](./v1-release-checklist.md)
