# Setup do banco de dados — Sinery System

Este documento cobre a fundação de banco de dados implementada no Prompt 02:
Prisma ORM + PostgreSQL, modelagem multi-tenant e o resolvedor de "clínica atual".

> **Autenticação real ainda não existe.** O usuário owner criado pelo seed não
> tem senha nem login funcional — isso vem em um prompt futuro.

## 1. Configurar DATABASE_URL

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite `.env` e preencha `DATABASE_URL` com uma das opções abaixo.

### Opção A — PostgreSQL local via Docker (recomendado para desenvolvimento)

Este repositório já inclui um `docker-compose.yml` com um Postgres pronto para uso:

```bash
docker compose up -d
```

Isso sobe um Postgres em `localhost:5432` com usuário `sinery`, senha `sinery` e
banco `sinery_system` — exatamente o que já está preenchido em `.env.example`:

```
DATABASE_URL="postgresql://sinery:sinery@localhost:5432/sinery_system?schema=public"
```

Não é necessário alterar nada se você usar o Docker Compose padrão.

### Opção B — Postgres gratuito externo (Neon, Supabase, etc.)

1. Crie um banco gratuito em [neon.tech](https://neon.tech) ou [supabase.com](https://supabase.com).
2. Copie a connection string fornecida (formato `postgresql://user:pass@host/db?sslmode=require`).
3. Cole em `DATABASE_URL` no seu `.env`.

O projeto funciona igualmente com as duas opções — nenhuma lógica no código
assume Docker especificamente.

## 2. Instalar dependências

```bash
npm install
```

## 3. Aplicar o schema no banco

Em desenvolvimento, a forma mais rápida é `db:push` (sem gerar arquivos de
migration versionados):

```bash
npm run db:push
```

Se preferir migrations versionadas (recomendado assim que o schema estabilizar):

```bash
npm run db:migrate
```

Ambos os comandos também rodam `prisma generate` automaticamente.

## 4. Rodar o seed

Cria a "Clínica Sorria Odonto" com configurações, um usuário owner mockado,
profissionais, pacientes, serviços, horários de atendimento, agendamentos,
configurações da Sinery Assist e alguns registros de auditoria.

```bash
npm run db:seed
```

O seed é idempotente: ele remove qualquer execução anterior do tenant
`sorria-odonto` (e tudo que depende dele, via cascade) antes de recriar os
dados — pode rodar quantas vezes quiser.

## 5. Abrir o Prisma Studio

Interface visual para navegar e editar os dados:

```bash
npm run db:studio
```

## 6. Testar o endpoint /api/health

Com `npm run dev` rodando:

```bash
curl http://localhost:3000/api/health
```

Resposta esperada com o banco conectado:

```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "2026-06-30T21:00:00.000Z",
  "environment": "development"
}
```

Se o banco estiver fora do ar, a rota responde com HTTP 503 e
`"status": "error"` / `"database": "error"`, sem expor detalhes internos do erro.

## 7. Validar a clínica mockada no dashboard

Acesse `http://localhost:3000/dashboard`. Logo abaixo do cabeçalho de boas-vindas
há um card **"Clínica atual"** que busca a clínica diretamente do banco
(via `getCurrentClinic()` em `lib/tenant.ts`) e mostra nome, segmento e status.

- Se o seed já rodou, o card mostra "Clínica Sorria Odonto".
- Se o banco não estiver acessível, o card mostra um aviso amarelo pedindo
  para conferir `DATABASE_URL` — o dashboard não quebra.
- Se o banco está acessível mas o seed não rodou, o card avisa para rodar
  `npm run db:seed`.

## Outros scripts úteis

| Script              | O que faz                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `npm run db:generate` | Regenera o Prisma Client a partir do schema                     |
| `npm run db:migrate`  | Cria/aplica uma migration em desenvolvimento                     |
| `npm run db:push`     | Sincroniza o schema com o banco sem criar arquivos de migration  |
| `npm run db:seed`     | Roda `prisma/seed.ts`                                            |
| `npm run db:studio`   | Abre o Prisma Studio                                              |
| `npm run db:reset`    | Reseta o banco (apaga tudo, reaplica migrations e roda o seed)   |

## Como o tenant (clínica) é resolvido hoje

Não existe autenticação nem roteamento por subdomínio real ainda. `lib/tenant.ts`
já está preparado para os dois cenários futuros, mas por enquanto funciona assim:

1. `getCurrentClinic()` lê o header `host` da requisição.
2. Tenta extrair um subdomínio via `extractSubdomainFromHost()` (por exemplo,
   `sorria-odonto.sinery.com.br` → `sorria-odonto`) — hoje, em
   desenvolvimento (`localhost:3000`), isso sempre retorna `null`.
3. Se não achar subdomínio, cai para `DEFAULT_TENANT_SLUG` (variável de
   ambiente, padrão `"sorria-odonto"`).
4. Busca a clínica no banco por esse slug.

Quando autenticação e multi-tenant por domínio forem implementados, apenas o
passo 2 precisa passar a valer de fato — o restante do código que consome
`getCurrentClinic()` não muda.

## Por que `clinicId + email` em vez de `email` global único em User?

O mesmo e-mail pode legitimamente precisar de uma conta em mais de uma clínica
(por exemplo, um profissional que atende em duas clínicas parceiras da
Sinery). Por isso o `User` usa `@@unique([clinicId, email])` em vez de um
`email` globalmente único — cada clínica tem seu próprio espaço de e-mails.

## O que NÃO foi implementado neste prompt

- Autenticação real (login, senha, sessão)
- IA real (Sinery Assist ainda é só configuração no banco)
- WhatsApp real
- Pagamentos (Sinery Pay)
- CRUD completo de pacientes, profissionais, serviços ou agenda — os models
  existem e têm dados de seed, mas as páginas `/pacientes`, `/agenda`, etc.
  continuam sendo placeholders visuais do Prompt 01.
