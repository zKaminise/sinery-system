# Banco de dados — staging & produção — Prompt 23

## Regras

1. **Postgres staging** e **Postgres produção** são bancos **separados**.
2. `DATABASE_URL` de staging **nunca** igual à de produção.
3. Use `?sslmode=require` (ou o que o provedor pedir) na connection string se o
   provedor exigir SSL (Neon, Supabase, RDS...).
4. **Nunca** `prisma db push` em staging/produção. Só `prisma migrate deploy`.
5. **Backup antes** de qualquer migration futura em produção.

## Migrations versionadas

Este repositório já tem a migration baseline em `prisma/migrations/0_init` (gerada
do schema atual — 29 tabelas, 29 enums, 86 índices) + `migration_lock.toml`.

**Primeiro deploy em um banco NOVO (staging/prod):**
```bash
DATABASE_URL="<staging-ou-prod>" npm run db:migrate:deploy   # aplica 0_init
DATABASE_URL="<...>" npm run db:generate
```

**Banco existente que já tinha o schema (via db:push):** faça o *baseline* uma vez
para não re-rodar o SQL:
```bash
DATABASE_URL="<...>" npx prisma migrate resolve --applied 0_init
```
(Foi o que fizemos no banco de dev local.)

**Novas mudanças de schema no futuro (em dev):**
```bash
npm run db:migrate:dev -- --name <descricao>   # cria prisma/migrations/<ts>_<descricao>
# revise o SQL, comite prisma/migrations, e em staging/prod:
npm run db:migrate:deploy
```

**Conferir estado:** `npm run db:migrate:status`.

## Seed staging (controlado)

O seed atual (`prisma/seed.ts`) cria a clínica de demonstração + founder + planos.
É **bloqueado em produção** (`NODE_ENV=production`, salvo `SEED_ALLOW_PRODUCTION=true`).

Para staging, o essencial é ter **founder + planos** (não a clínica fake). Opções:
- Rodar o seed completo (aceitável em staging de demo).
- OU um seed:staging enxuto (só PlatformUser founder + planos) — **não implementado
  neste prompt** (documentado para um prompt futuro; hoje use o seed completo com
  cuidado, ou crie o founder+planos manualmente).

**Produção:** NÃO rode o seed fake. Crie o `PlatformUser` FOUNDER real e os planos
manualmente (ou por um script controlado).
