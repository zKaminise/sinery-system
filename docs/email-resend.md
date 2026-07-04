# E-mail transacional (Resend) — Prompt 22

Envio de e-mails transacionais via **Resend**, server-only, com `EmailLog` e modo
mock. Nenhuma `RESEND_API_KEY` vai para o browser/logs.

## Configuração

`.env`:
```
RESEND_API_KEY=""                       # server-only; vazio → mock
RESEND_FROM_EMAIL="Sinery <no-reply@sinery.com.br>"
RESEND_REPLY_TO_EMAIL="kaminise@sinery.com.br"
EMAIL_MOCK_MODE="true"                   # "false" envia de verdade
```

- **From:** `no-reply@sinery.com.br` (via Resend). **Não precisa existir como caixa
  postal** — é só o remetente autorizado no domínio verificado no Resend.
- **Reply-To:** `kaminise@sinery.com.br` (respostas caem aqui). Deve ser um e-mail real.
- No Resend, verifique o domínio `sinery.com.br` (DNS SPF/DKIM) para enviar como
  `no-reply@sinery.com.br`.

## Como funciona

`sendTransactionalEmail({ to, subject, html, text?, type, clinicId?, userId?, platformUserId?, metadata?, replyTo? })`
(`lib/email/email-service.ts`):

- Cria sempre um **`EmailLog`** (nunca grava o corpo sensível — código/senha ficam
  fora do `metadata`).
- `EMAIL_MOCK_MODE=true` **ou** sem `RESEND_API_KEY` → status `MOCKED`, nada é
  enviado (em dev, loga um preview seguro no console).
- Caso contrário → envia via Resend, status `SENT` (+ `providerMessageId`) ou
  `FAILED` (erro sanitizado, sem chave).
- **Nunca lança** — um e-mail que falha não quebra o fluxo (ex.: a clínica continua
  criada mesmo se o welcome falhar; o `EmailLog` fica `FAILED` e o founder pode
  reenviar acesso).

## Templates (`lib/email/email-templates.ts`)

`password-reset-code`, `owner-welcome-created-by-founder`,
`owner-welcome-created-by-checkout`, `temporary-password-reset`,
`billing-payment-confirmed`, `billing-payment-overdue`, `checkout-payment-pending`.
HTML simples + fallback `text`.

## Testar

- **Mock:** `EMAIL_MOCK_MODE=true` → dispare qualquer fluxo (recuperação de senha,
  criar clínica) e veja o registro em `/founder/emails` como `MOCKED`.
- **Real:** `RESEND_API_KEY` válida + `EMAIL_MOCK_MODE=false` → o e-mail chega com
  from `no-reply@sinery.com.br` e reply-to `kaminise@sinery.com.br`.

## Segurança

`RESEND_API_KEY` só no servidor (lida apenas em `resend-client.ts`), nunca em
`NEXT_PUBLIC_*`, logs, HTML ou `EmailLog`. Erros são sanitizados
(`email-sanitize.ts`). `EmailLog` não expõe corpo/código/senha.
