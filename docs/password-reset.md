# Recuperação de senha — Prompt 22

Fluxo "esqueci minha senha" com código de 6 dígitos, para usuários de clínica
**e** PlatformUsers (founder).

## Fluxo

1. `/esqueci-senha` → informa e-mail → `POST /api/auth/password-reset/request`.
   Resposta **sempre genérica**: *"Se este e-mail estiver cadastrado, enviaremos
   um código."* (nunca revela se o e-mail existe).
2. Se houver um usuário ACTIVE, um **código de 6 dígitos** é gerado, seu **hash**
   (HMAC-SHA256 com `AUTH_SECRET`) é salvo, expira em **10 min**, e é enviado por
   e-mail (Resend/mock). O código **nunca** é salvo em texto puro.
3. `/redefinir-senha?email=...` → digita o código → `POST .../verify` (checa sem
   consumir; incrementa tentativas em erro). Botão **Reenviar** com cooldown de 60s.
4. Código válido → libera nova senha + confirmação → `POST .../reset`:
   valida senha forte, atualiza `passwordHash`, `temporaryPassword=false`,
   `passwordChangedAt=now`, marca o token como **usado** (uso único) e invalida os
   demais. Redireciona ao `/login`.

## Regras de segurança

- Código só como **hash** (HMAC-SHA256), **uso único**, expira em 10 min.
- **Máx. 5 tentativas** por token (env `PASSWORD_RESET_MAX_ATTEMPTS`); depois bloqueia.
- **Cooldown de reenvio** de 60s por e-mail (env `PASSWORD_RESET_RESEND_COOLDOWN_SECONDS`).
- **Não revela** se o e-mail existe (resposta genérica sempre).
- Só usuários **ACTIVE**. Clínica suspensa: o reset é permitido, mas ao logar o
  usuário continua vendo a tela de suspensão.
- Em **produção**, o código nunca é logado. Em **dev**, um preview seguro aparece
  no console do servidor (`NODE_ENV !== production`).

## Config (env)

```
PASSWORD_RESET_TOKEN_TTL_MINUTES="10"
PASSWORD_RESET_MAX_ATTEMPTS="5"
PASSWORD_RESET_CODE_LENGTH="6"
PASSWORD_RESET_RESEND_COOLDOWN_SECONDS="60"
```

## Founder vs clínica

O mesmo fluxo cobre `User` (clínica) e `PlatformUser` (founder). A busca prioriza
o `User` de clínica; se o e-mail existir apenas como PlatformUser, reseta a senha
de plataforma. **Edge case:** um e-mail que exista nos dois reseta o usuário de
clínica (documentado; sem revelar o tipo).

## Testar (mock)

`EMAIL_MOCK_MODE=true` → `/esqueci-senha` com um e-mail existente → pegue o código
no log do servidor dev → `/redefinir-senha` → nova senha → login. Veja o `EmailLog`
`MOCKED` em `/founder/emails`.
