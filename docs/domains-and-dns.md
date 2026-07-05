# Domínios e DNS — Prompt 23

Arquitetura recomendada. **Site** e **sistema** podem (e devem) ser projetos Vercel
**separados**.

## Domínios

| Domínio | Projeto | Uso |
|---|---|---|
| `sinery.com.br` / `www.sinery.com.br` | **Site** | Institucional + formulário de checkout |
| `app.sinery.com.br` | **Sistema** | Login geral / produção |
| `hml.app.sinery.com.br` | **Sistema** | Homologação / HML (staging) |
| `{slug}.app.sinery.com.br` | **Sistema** | Tenant (clínica) futuro (wildcard) |

- O **site** (`sinery.com.br`) chama a **API do sistema** (`.../api/public/checkout/start`).
- Rotas `/founder` ficam no **sistema** (app/staging), não no site.

## Tenant resolver (`resolveTenantFromHost`)

Passe `rootDomain="sinery.com.br"`:

| Host | Resolve |
|---|---|
| `localhost` | `default` (DEFAULT_TENANT_SLUG) |
| `sinery.com.br`, `www.sinery.com.br` | `marketing` (nunca clínica) |
| `app.sinery.com.br` | `app` (login geral) |
| `hml.app.sinery.com.br` | `app` (`hml`/`staging` são reservados → NÃO viram clínica) |
| `{slug}.app.sinery.com.br` | `clinic` slug |
| `admin/api/checkout/dev/... .app.sinery.com.br` | `app` (slug reservado) |

**Slugs reservados** (`RESERVED_SLUGS`, testado): `app`, `www`, `admin`, `founder`,
`api`, `status`, `suporte`, `support`, `sinery`, `sinere`, `staging`, `hml`,
`homolog`, `dev`, `checkout`, `auth`, `mail`, `static`, `assets`, `cdn`. Nenhum
deles pode ser slug de clínica (nem no checkout, nem na criação manual).

## DNS / e-mail (NÃO apagar)

- **Não apague** registros **SPF / DKIM / DMARC** do Resend em `sinery.com.br` —
  são necessários para enviar como `no-reply@sinery.com.br`.
- **MX** de `sinery.com.br` (caixa `kaminise@sinery.com.br`) continua apontando
  para o provedor de e-mail atual — o Resend só adiciona TXT/CNAME de envio, não
  mexe no recebimento.

## Wildcard por ambiente (subdomínio automático de clínica)

Cada clínica é acessada por um subdomínio derivado do slug, **por ambiente**:

| Ambiente | App root | Clínica (wildcard) |
|---|---|---|
| **HML** | `hml.app.sinery.com.br` | `*.hml.app.sinery.com.br` → `{slug}.hml.app.sinery.com.br` |
| **PRD** | `app.sinery.com.br` | `*.app.sinery.com.br` → `{slug}.app.sinery.com.br` |

Para habilitar:
1. **DNS**: registro wildcard `*.hml.app.sinery.com.br` (HML) e/ou `*.app.sinery.com.br` (PRD), CNAME → Vercel.
2. **Vercel**: adicione o domínio wildcard ao projeto correspondente (HML → projeto HML; PRD → projeto PRD).
3. O helper `buildTenantUrl` (`lib/tenant/tenant-url.ts`) já gera a URL correta a partir do **APP_URL** do ambiente (sem hardcode), e `resolveTenantFromHost` (com `appPrefix` derivado por `getTenantResolveOptions`) já extrai o slug de `{slug}.hml.app.<root>` e `{slug}.app.<root>`. Slugs reservados nunca viram clínica.

> **Criar uma clínica no Founder NÃO cria um registro DNS individual.** É o **wildcard** que resolve todos os slugs de uma vez. Enquanto o wildcard não estiver configurado, o login continua funcionando pelo host geral (`hml.app.sinery.com.br` / `app.sinery.com.br`) — só o subdomínio por clínica depende do wildcard.

## Segurança multi-tenant por subdomínio (Prompt 27)

Regras de acesso por host (implementadas em `lib/tenant/tenant-security.ts` —
puro/testado — e ligadas ao runtime por `lib/tenant/tenant-context.ts`):

- **Raiz** (`hml.app.sinery.com.br` / `app.sinery.com.br`): área do **Founder**
  (`/founder`), `/api/health`, `/status`. **Não** é login de clínica quando a
  aplicação está com o enforcement ligado — mostra uma tela explicando “Acesse
  pelo endereço da sua clínica (ex.: `https://sua-clinica.hml.app.sinery.com.br`)”.
  A raiz **nunca** cai em `DEFAULT_TENANT_SLUG` em staging/produção.
- **Subdomínio de clínica** (`{slug}.hml.app.<root>` / `{slug}.app.<root>`):
  resolve `clinic.slug`; o login é **escopado** ao `clinicId` da clínica do host.
  Um usuário da **clínica A** que tente logar no subdomínio da **clínica B** é
  negado **mesmo com a senha correta** (o e-mail não pertence à clínica B) — erro
  genérico, sem revelar se usuário/clínica existem.
- **Vínculo sessão↔host**: em cada request autenticado, `session`/clínica do
  usuário precisa bater com a clínica resolvida pelo host. Divergência →
  logout/negação + auditoria `TENANT_SESSION_MISMATCH`. Nunca confiamos em
  `clinicId` vindo do frontend.
- **Founder**: só na raiz. Em subdomínio de clínica, o proxy redireciona para a
  raiz. Cookie de plataforma ≠ cookie de clínica (claim `typ:"platform"`).

**Flag — `TENANT_SUBDOMAIN_ENFORCED`** (padrão `false` no código): bloqueia o
login de clínica na raiz **apenas** quando `true` **e** o ambiente é
staging/produção. A negação de login cross-tenant e o vínculo sessão↔host são
**sempre** ativos (só disparam em subdomínio real de clínica). **HML: o wildcard
`*.hml.app.sinery.com.br` já está validado/funcional na Vercel → defina
`TENANT_SUBDOMAIN_ENFORCED=true` no projeto HML.** PRD: ligue para `true` só
depois de validar `*.app.sinery.com.br` (senão ligar trancaria o login da raiz
antes de o subdomínio resolver).

### Checklist de wildcard (9 passos)

1. **DNS wildcard**: crie `*.hml.app.sinery.com.br` (HML) e/ou `*.app.sinery.com.br`
   (PRD) como **CNAME → Vercel** (`cname.vercel-dns.com`).
2. **Vercel — HML**: no projeto de HML, adicione **dois** domínios:
   `hml.app.sinery.com.br` (raiz) **e** `*.hml.app.sinery.com.br` (wildcard).
3. **Vercel — PRD**: no projeto de produção, adicione `app.sinery.com.br` **e**
   `*.app.sinery.com.br`.
4. **Verificação Vercel**: aguarde os domínios ficarem “Valid Configuration”
   (certificado TLS emitido para o wildcard).
5. **Env**: confirme `NEXT_PUBLIC_ROOT_DOMAIN=sinery.com.br` e `APP_URL` do
   ambiente (`https://hml.app.sinery.com.br` / `https://app.sinery.com.br`).
   `DEFAULT_TENANT_SLUG` fica **vazio** em staging/produção.
6. **Smoke test de host**: acesse `{slug}.hml.app.sinery.com.br` de uma clínica de
   teste e confirme que a tela de login aparece no subdomínio (não na raiz).
7. **Login escopado**: logue com um usuário dessa clínica no subdomínio dela;
   confirme que um usuário de outra clínica é negado ali.
8. **Ligue a flag**: defina `TENANT_SUBDOMAIN_ENFORCED=true` no projeto (HML e/ou
   PRD). Agora a raiz mostra a tela “acesse pelo endereço da sua clínica”.
9. **Regressão**: valide Founder na raiz, `TENANT_SESSION_MISMATCH` no host errado
   e que e-mail/Resend continuam funcionando.

> **Criar uma clínica no Founder NÃO cria um registro DNS.** O wildcard resolve
> todos os slugs de uma vez; o código resolve o slug pelo host. Nenhum passo do
> checklist mexe em registros de **e-mail**.

## DNS de e-mail e provedor — NÃO apagar

Ao adicionar o wildcard **não remova** nenhum destes registros da zona
`sinery.com.br`:

- **MX** (recebimento de `kaminise@sinery.com.br`) — provedor de e-mail atual.
- **SPF / DKIM / DMARC** do **Resend** (TXT/CNAME de envio de `no-reply@sinery.com.br`).
- Registros do provedor de hospedagem/DNS (ex.: **Umbler**) do site/zona.

O wildcard é apenas um CNAME de subdomínio de app; é ortogonal aos registros de
e-mail e do site. Adicione, não substitua.

## URLs da API pública de checkout

- HML: `https://hml.app.sinery.com.br/api/public/checkout/start`
- Produção: `https://app.sinery.com.br/api/public/checkout/start`

Contrato completo: [site-checkout-integration.md](./site-checkout-integration.md).
