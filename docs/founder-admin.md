# Painel Founder / Platform Admin (Prompt 21)

Módulo interno para o fundador operar a Sinery manualmente (criar clínicas,
planos, assinaturas, faturas e suspensões) **antes** de existir site/checkout
automático. Sem cobrança real — tudo é registro manual.

Rotas: `/founder/login`, `/founder`, `/founder/clientes`, `/founder/clientes/novo`,
`/founder/clientes/[clinicId]`, `/founder/planos`, `/founder/billing`,
`/founder/alterar-senha`.

## 1. PlatformUser vs User da clínica

| | **PlatformUser** | **User (clínica)** |
|---|---|---|
| Pertence a uma Clinic? | Não | Sim (`clinicId`) |
| Cookie de sessão | `sinery_platform_session` | `sinery_session` |
| Rotas | `/founder/*` | `/dashboard`, `/agenda`, ... |
| Papéis | FOUNDER / PLATFORM_ADMIN / SUPPORT / FINANCE | OWNER / ADMIN / RECEPTIONIST / PROFESSIONAL |
| Helpers | `getCurrentPlatformUser`, `requirePlatformApiUser` | `getCurrentUser`, `requireApiUser` |

São **totalmente separados**: as duas sessões usam o mesmo `AUTH_SECRET`, mas o
token de plataforma carrega um claim `typ: "platform"` verificado na leitura, então
um JWT de clínica nunca é aceito como sessão de plataforma (e vice-versa). Um
usuário de clínica que tenta abrir `/founder` é redirecionado para `/founder/login`
(o `proxy.ts` checa o cookie de plataforma). Um PlatformUser não tem cookie de
clínica, então nunca acessa o dashboard de uma clínica.

**Usuário dev (seed):** `founder@sinery.local` / `Sinery@123` (FOUNDER, senha
provisória → troca no 1º acesso). Em **produção**, o fundador é criado
manualmente (o seed é bloqueado em produção).

## 2. Papéis da plataforma

- **FOUNDER / PLATFORM_ADMIN** — tudo (clínicas, planos, billing).
- **FINANCE** — billing/faturas, mas não cria clínicas nem planos.
- **SUPPORT** — visualiza, sem mexer em financeiro/planos.

(`lib/platform/platform-permissions.ts`: `canManageClinics`, `canManageBilling`,
`canManagePlans`.)

## 3. Criar uma clínica manualmente

`/founder/clientes/novo`. Um único fluxo cria de forma transacional:
Clinic + ClinicSettings + AiSettings + WhatsAppIntegration + **User OWNER** (senha
provisória) + ClinicSubscription (+ 1ª BillingInvoice se plano pago) + BillingEvent +
PlatformAuditLog.

Campos: dados da clínica (nome, **slug**, segmento, e-mail, telefone, cidade/UF),
responsável (nome, e-mail, senha opcional), comercial (tipo, plano, valor, início,
vencimento, tolerância, observações).

**Tela de sucesso** mostra URL, e-mail do owner e a **senha provisória (uma única
vez)** + botão "Copiar mensagem de boas-vindas". O envio por e-mail (Resend) virá
depois — por ora, copie e envie manualmente.

`clinicId` **nunca** vem do frontend nas operações sensíveis — o founder age por
`clinicId` de rota, sempre validando existência no servidor.

## 4. Slug / subdomínio

Regras (`lib/platform/slug.ts`): minúsculas, sem espaços/acentos, apenas
`a-z 0-9 -`, 3–40 chars, único. **Reservados** (bloqueados): `app`, `www`, `admin`,
`founder`, `api`, `status`, `suporte`, `sinery`, `sinere`, etc.

**Resolução por host** (`lib/platform/tenant-resolver.ts`), preparada para o futuro
(sem depender de DNS agora):

| Host | Resolve para |
|---|---|
| `localhost` | tenant padrão (`DEFAULT_TENANT_SLUG`) |
| `sinere.com.br`, `www.sinere.com.br` | site institucional |
| `app.sinere.com.br` | login geral |
| `{slug}.app.sinere.com.br` | clínica `{slug}` |
| `{slug}.sinere.com.br` | clínica `{slug}` |
| slug reservado | não vira clínica (cai em `app`) |

`/founder` **não** depende de tenant.

**Wildcard DNS (futuro):** criar um registro `*.app.sinere.com.br` apontando para o
app; na Vercel, adicionar o domínio wildcard `*.app.sinere.com.br` ao projeto.
Localmente, continue usando `localhost` + `DEFAULT_TENANT_SLUG` (nada muda).

## 5. Planos, assinaturas e faturas

- **Plan** — catálogo comercial (nome, slug, preço em centavos, intervalo, limites,
  inclui IA/WhatsApp, ativo). Gerenciado em `/founder/planos`.
- **ClinicSubscription** — 1 por clínica. Status: FREE / TRIALING / ACTIVE /
  PAST_DUE / SUSPENDED / CANCELLED / EXEMPT. `billingType`/`paymentMethod` = MANUAL
  na V1. Guarda `nextDueDate`, `graceDays` (padrão 20), `overdueSince`.
- **BillingInvoice** — fatura manual (PENDING/PAID/OVERDUE/CANCELLED...). Campos
  `external*` são placeholders para Asaas/Stripe futuros.
- **BillingEvent** — trilha comercial legível (criada, paga, suspensa...).

Tipos comerciais na criação → mapeamento (`founder-actions.ts`): `free`→FREE,
`exempt`→EXEMPT, `trial`→TRIALING, `monthly`→ACTIVE/mensal, `yearly`→ACTIVE/anual,
`founder_deal`→ACTIVE/mensal (com nota), `custom`→ACTIVE/custom.

Receita (`lib/billing/revenue.ts`): **MRR** = soma do valor mensal-normalizado das
assinaturas ACTIVE + PAST_DUE (anual = valor/12; free/one-time = 0). **ARR** = MRR×12.

## 6. Atraso e suspensão

`evaluateSubscriptionStatus(sub, now)` (puro, testado):

1. FREE/EXEMPT → nunca suspende.
2. CANCELLED → bloqueia a clínica.
3. TRIALING com `trialEndsAt` futuro → ativo.
4. `nextDueDate` hoje/futuro → ACTIVE.
5. `nextDueDate` passado → PAST_DUE (marca `overdueSince`).
6. Atraso **> graceDays** (padrão 20) → no 21º dia, **SUSPENDED** + `Clinic.status
   SUSPENDED`.

Ações manuais no founder (`/founder/clientes/[id]` e lista): **Suspender**,
**Liberar**, **Recalcular status**, **Criar fatura**, **Marcar pago** (reativa +
avança o vencimento), **Marcar vencida**, **Cancelar fatura**. Há também
"Recalcular status de todas" em `/founder/billing`.

## 7. Suspensão no acesso da clínica

Se `Clinic.status = SUSPENDED` (ou INACTIVE), o layout autenticado
(`app/(app)/layout.tsx`) mostra uma **tela clara de bloqueio** ("Acesso
temporariamente suspenso. Entre em contato com a Sinery.") com botão de logout —
em vez de derrubar o usuário no /login. Isso bloqueia **apenas aquela clínica**;
as outras continuam funcionando. O founder libera pelo painel (ou o pagamento
manual reativa). PlatformUser nunca é bloqueado por isso.

`SETUP_PENDING` e `ACTIVE` continuam com acesso normal (comportamento inalterado).

## 8. Isolamento entre clínicas

- Todas as queries operacionais continuam escopadas por `clinicId` (Prompt 20).
- O founder vê **agregados** (contagens, receita) — nenhum dado sensível de
  paciente é exibido no painel.
- Suspender/cobrar uma clínica só altera aquela clínica (verificado ao vivo:
  suspender a Piloto Alpha não afetou a Sorria Odonto).
- Rotas `/api/founder/*` exigem `requirePlatformApiUser` + a capability do papel.

## 9. Auditoria de plataforma

`PlatformAuditLog` (separado do `AuditLog` por-clínica). Ações:
`PLATFORM_LOGIN_SUCCESS/FAILED`, `LOGOUT`, `CLINIC_CREATED/UPDATED/SUSPENDED/
REACTIVATED`, `OWNER_CREATED`, `SUBSCRIPTION_CREATED`, `INVOICE_CREATED/
MARKED_PAID/MARKED_OVERDUE/CANCELLED`, `PLAN_CREATED/UPDATED`,
`BILLING_STATUS_RECALCULATED`, `NOTIFICATION_MOCKED`. **Nunca** grava
senha/hash/token/conteúdo sensível.

## 10. Preparado para o futuro (NÃO implementado agora)

- **Asaas/Stripe/checkout:** `BillingInvoice.external{Provider,InvoiceId,PaymentUrl}`
  + `BillingType CHECKOUT/API/EXTERNAL` já existem; a criação de fatura/pagamento
  hoje é manual. Um webhook de provedor futuramente marcará faturas como pagas.
- **Resend/e-mails:** `BillingNotificationLog` registra lembretes como `MOCKED`
  (preview + assunto), sem enviar. Cenários: vence em breve / venceu / aviso de
  suspensão / suspenso / pago. O envio real virá com o Resend.

## 11. Testar localmente

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```
1. `/founder/login` → `founder@sinery.local` / `Sinery@123` → trocar senha.
2. `/founder` (cards) → `/founder/clientes` → **Nova clínica** (ex.: Piloto Alpha,
   slug `piloto-alpha`, owner `owner@pilotoalpha.com.br`, plano Founder Pilot).
3. Copie a senha provisória da tela de sucesso.
4. Logout founder → logue como o owner da nova clínica → acesse `/dashboard`.
5. No founder, **suspenda** a Piloto Alpha → o owner vê a tela de suspensão; a
   Sorria Odonto continua acessível. **Libere** → volta a funcionar.
6. Crie fatura manual → marque como paga (reativa). Teste slug reservado `admin`
   → bloqueado.

## 12. NÃO implementado (fora de escopo da V1)

Pagamento real, Asaas, Stripe, checkout do site, envio real de e-mail, Resend,
nota fiscal, portal público de assinatura, upgrade/downgrade automático por
pagamento externo, cupons, relatórios avançados, impersonar clínica, exportação
CSV de faturas, tela `/founder/configuracoes` completa.
