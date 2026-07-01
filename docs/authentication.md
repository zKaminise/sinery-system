# Autenticação — Sinery System

Este documento cobre a autenticação real implementada no Prompt 03: login com
e-mail/senha, sessão em cookie HTTP-only, proteção de rotas e troca
obrigatória de senha no primeiro acesso.

## 1. Configurar AUTH_SECRET

A sessão é um JWT assinado com [jose](https://github.com/panva/jose). A chave
de assinatura vem de `AUTH_SECRET` e é **obrigatória** — se estiver ausente, a
aplicação lança um erro claro no momento em que tenta criar ou ler uma sessão
(ver `lib/session.ts`), em vez de silenciosamente usar um segredo fixo.

```bash
cp .env.example .env
openssl rand -base64 32   # cole o resultado em AUTH_SECRET no .env
```

Outras variáveis relacionadas (com valores padrão caso omitidas):

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `AUTH_SECRET` | — (obrigatória) | Chave HMAC usada para assinar/verificar o JWT da sessão |
| `SESSION_COOKIE_NAME` | `sinery_session` | Nome do cookie HTTP-only |
| `SESSION_MAX_AGE_SECONDS` | `604800` (7 dias) | Duração da sessão |

Nenhum segredo real está commitado no repositório — `.env.example` só traz o
placeholder `"change-me-in-development"`.

## 2. Usuário inicial do seed

```bash
npm run db:seed
```

Cria (entre outros dados) o usuário owner da Clínica Sorria Odonto:

| Campo | Valor |
| --- | --- |
| Nome | Gabriel Admin |
| E-mail | `admin@sorriaodonto.com.br` |
| Senha provisória | `Sinery@123` |
| Role | OWNER |
| Status | ACTIVE |
| `temporaryPassword` | `true` |

> ⚠️ **`Sinery@123` é uma senha só para desenvolvimento local.** Ela é
> gerada com hash bcrypt no seed (nunca fica em texto puro no banco) e existe
> apenas para permitir o primeiro login local. Nunca reutilize esse valor em
> um ambiente real.

## 3. Fluxo de login

1. Acesse `/login` (sem sidebar/header — layout público).
2. Informe e-mail e senha e envie o formulário.
3. `POST /api/auth/login` valida com Zod, busca o usuário por e-mail
   (normalizado para minúsculas), compara a senha com `bcrypt.compare` contra
   `passwordHash`, e checa `user.status === "ACTIVE"` e
   `user.clinic.status === "ACTIVE"`.
4. Em caso de sucesso: cria um cookie de sessão HTTP-only contendo apenas
   `{ userId, clinicId, role, exp }` (nada sensível) e grava um
   `AuditLog` `AUTH_LOGIN_SUCCESS`.
5. Em caso de falha (e-mail não existe, senha errada, usuário inativo, ou
   clínica inativa/suspensa): sempre a mesma mensagem genérica —
   **"E-mail ou senha inválidos."** — e um `AuditLog` `AUTH_LOGIN_FAILED`
   (sem senha, sem hash).
6. O formulário navega para `/dashboard`. O layout autenticado
   (`app/(app)/layout.tsx`) então decide, com base nos dados reais do banco,
   se o usuário segue para o dashboard ou é redirecionado para
   `/alterar-senha` (ver seção 4).

### Por que a busca de login não é isolada por clínica

O formulário de login pede apenas e-mail/senha, sem seletor de clínica ou
subdomínio. Por isso, `lib/auth.ts` busca o usuário por e-mail globalmente
(`prisma.user.findFirst({ where: { email } })`), embora o schema garanta
unicidade apenas por `clinicId + email` (de propósito, pensando em clínicas
parceiras — ver `docs/setup-database.md`). Isso é uma limitação conhecida
deste MVP: com um único tenant seedado não há ambiguidade, mas antes de abrir
cadastro para múltiplas clínicas com e-mails repetidos, o login precisa
ganhar um passo de seleção de tenant (por subdomínio ou campo explícito).

## 4. Troca obrigatória de senha no primeiro acesso

- O token de sessão **não** contém `temporaryPassword` (por design — o token
  guarda só `userId`, `clinicId`, `role`, `exp`).
- Por isso, o redirecionamento para `/alterar-senha` não acontece no Proxy
  (`proxy.ts`), que só faz uma checagem otimista via cookie (sem consultar o
  banco, por performance). Ele acontece em `app/(app)/layout.tsx`, que chama
  `getCurrentUser()` (consulta real ao banco) e redireciona se
  `user.temporaryPassword === true`.
- Em `/alterar-senha`, o usuário define uma nova senha (mínimo 8 caracteres,
  pelo menos 1 letra e 1 número, confirmação precisa bater).
- `POST /api/auth/change-password` faz hash da nova senha, atualiza
  `passwordHash`, zera `temporaryPassword` (`false`) e preenche
  `passwordChangedAt`. Grava `AuditLog` `AUTH_PASSWORD_CHANGED`.
- O formulário redireciona para `/dashboard` após sucesso.

## 5. Como testar logout

1. Logado, clique no avatar no header → "Sair".
2. Isso chama `POST /api/auth/logout`, que apaga o cookie de sessão e grava
   `AuditLog` `AUTH_LOGOUT`.
3. Você é redirecionado para `/login`.
4. Tentar acessar `/dashboard` diretamente depois disso deve redirecionar de
   volta para `/login` (Proxy barra a rota por falta de cookie válido).

## 6. Arquitetura (por que autenticação própria, não NextAuth/Auth.js)

Para este MVP, o fluxo de senha provisória + multi-tenant é simples o
suficiente para não justificar a complexidade extra de um provider genérico
como NextAuth/Auth.js (que adiciona seu próprio modelo de dados, adapters,
providers, e uma superfície de configuração maior do que o necessário aqui).
Implementação própria e enxuta:

- **Hash de senha:** `bcryptjs` (`lib/password.ts`), 10 rounds. Nunca senha
  em texto puro no banco.
- **Sessão:** JWT assinado com `jose` (`lib/session.ts`), guardado em cookie
  HTTP-only (`httpOnly`, `sameSite: "lax"`, `secure` em produção, `maxAge`
  configurável). Payload mínimo: `userId`, `clinicId`, `role`, `exp`.
- **Proteção de rotas — duas camadas, de propósito:**
  1. **`proxy.ts`** (substitui o antigo `middleware.ts` a partir do Next.js
     16): checagem *otimista*, só decodifica o cookie, sem tocar o banco.
     Redireciona não-autenticados para `/login` e autenticados que tentam
     acessar `/login` de volta para `/dashboard`.
  2. **`app/(app)/layout.tsx`**: checagem *autoritativa*, via
     `getCurrentUser()` (`lib/current-user.ts`), que consulta o banco a cada
     requisição — revalida se o usuário/clínica seguem `ACTIVE` e resolve o
     redirecionamento para `/alterar-senha` quando `temporaryPassword` é
     `true`.

  Essa separação segue a orientação oficial do Next.js para autenticação:
  Proxy roda em toda requisição (inclusive prefetches) e não deve fazer
  consultas lentas; checagens que dependem de dados atualizados do banco
  devem ficar perto da fonte de dados.
- **DTO de usuário:** `getCurrentUser()` sempre retorna um objeto sem
  `passwordHash` — a query ao Prisma usa `select` explícito, então o hash
  nunca chega perto de uma resposta ou de um componente client.
- **Auditoria:** `lib/audit.ts` centraliza a escrita de `AuditLog` e nunca
  lança erro para quem chamou (falha ao gravar auditoria não pode derrubar o
  login/logout/troca de senha).

## 7. O que ainda NÃO foi implementado

- Recuperação de senha por e-mail (o link "Esqueci minha senha" na tela de
  login existe visualmente, mas está desabilitado com "em breve")
- Convite de usuários / cadastro público
- Autenticação de dois fatores (2FA)
- Login social (Google, Microsoft, etc.)
- Login por subdomínio / seleção explícita de clínica (ver seção 3)
- Refresh token / renovação automática de sessão antes de expirar
- Limite de tentativas de login (rate limiting) — recomendado antes de ir
  para produção
- Envio real de e-mail (nenhuma integração como Resend foi adicionada)
- IA real, WhatsApp real, pagamentos — fora de escopo deste prompt
