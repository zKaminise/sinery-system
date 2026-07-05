# Git Flow — Sinery System

Fluxo de branches e como cada uma se conecta aos projetos Vercel e bancos Neon.

## Branches

### `main` — Produção (PRD)
- Ambiente de **produção**.
- Domínio: `app.sinery.com.br`.
- Projeto Vercel: **PRD** (production branch = `main`).
- `APP_ENV=production`.
- Banco: **Neon PRD** (separado).
- Provider de mensageria: **META_CLOUD_API** (API oficial da Meta).
- **Nunca** commitar direto na `main`. Só recebe merges de `develop` estável via PR.

### `develop` — Homologação (HML)
- Ambiente de **homologação/HML**.
- Domínio: `hml.app.sinery.com.br`.
- Projeto Vercel: **HML** (production branch = `develop`).
- `APP_ENV=staging`.
- Banco: **Neon HML** (separado do de produção).
- Provider de mensageria: **EVOLUTION_API** (para testar WhatsApp real com número interno).
- Evite commit direto; prefira PRs de `feature/*`. **Deve estar sempre testável** (gates verdes).

### `feature/nome-da-feature` — Desenvolvimento
- Desenvolvimento local, a partir de `develop`.
- Pull Request para `develop`.
- **Não** deve ser usada como HML oficial.
- Pode quebrar localmente, mas **não vai para `develop` sem os gates verdes**.

## Fluxo de trabalho

1. Criar a feature a partir de `develop`.
2. Desenvolver localmente.
3. Rodar os gates:
   ```bash
   npm run test
   npm run lint
   npx tsc --noEmit
   npm run build
   ```
4. Abrir PR para `develop`.
5. Merge na `develop`.
6. A Vercel **HML** publica `hml.app.sinery.com.br`.
7. Testar em HML (inclui WhatsApp real via Evolution).
8. Abrir PR `develop` → `main`.
9. Merge na `main`.
10. A Vercel **PRD** publica `app.sinery.com.br`.

## Comandos

Criar uma feature:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/nome-da-feature
```

Antes de abrir o PR (gates obrigatórios):
```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
```

## Regras

- Nunca commitar direto na `main`.
- Evitar commit direto na `develop`.
- `develop` precisa estar testável (gates verdes).
- PRD só recebe `develop` estável.
- Feature branch pode quebrar localmente, mas não sobe para `develop` sem os gates verdes.

## Mapa de ambientes

| Branch | Ambiente | Domínio | Projeto Vercel | APP_ENV | Banco | Provider |
|---|---|---|---|---|---|---|
| `main` | Produção | app.sinery.com.br | PRD | `production` | Neon PRD | META_CLOUD_API |
| `develop` | HML | hml.app.sinery.com.br | HML | `staging` | Neon HML | EVOLUTION_API |
| `feature/*` | Local | localhost:3000 | — | `local` | Docker 5544 | EVOLUTION_API (mock) |

Ver também: [vercel-staging.md](./vercel-staging.md), [deploy-staging.md](./deploy-staging.md),
[domains-and-dns.md](./domains-and-dns.md), [evolution-api-hml.md](./evolution-api-hml.md).
