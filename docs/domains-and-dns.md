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

## URLs da API pública de checkout

- HML: `https://hml.app.sinery.com.br/api/public/checkout/start`
- Produção: `https://app.sinery.com.br/api/public/checkout/start`

Contrato completo: [site-checkout-integration.md](./site-checkout-integration.md).
