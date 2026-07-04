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

## Wildcard (tenants futuros)

Para `{slug}.app.sinery.com.br`:
1. DNS: registro wildcard `*.app.sinery.com.br` (CNAME → Vercel).
2. Vercel: adicione o domínio wildcard `*.app.sinery.com.br` ao projeto do sistema.
3. O `resolveTenantFromHost` já extrai o slug (basta usar `rootDomain` correto e o
   proxy/página consumir o slug). Slugs reservados continuam bloqueados.

## URLs da API pública de checkout

- HML: `https://hml.app.sinery.com.br/api/public/checkout/start`
- Produção: `https://app.sinery.com.br/api/public/checkout/start`

Contrato completo: [site-checkout-integration.md](./site-checkout-integration.md).
