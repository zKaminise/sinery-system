# Observabilidade — Sinery System

Fundação de observabilidade implementada no Prompt 04: captura de erros
(Sentry), logger estruturado, health checks, página de status, auditoria
interna e respostas de erro padronizadas.

## 1. O que é monitorado na V1

| Área | Como | Onde |
| --- | --- | --- |
| Erros server/client | Sentry (opcional) | `instrumentation.ts`, `instrumentation-client.ts` |
| Logs de aplicação | Logger estruturado | `lib/logger.ts` |
| Liveness | `/api/health` (leve, sem banco) | monitor externo |
| Saúde profunda | `/api/health/deep` (banco + métricas) | página `/status`, monitor externo |
| Auditoria de negócio | `AuditLog` + `/auditoria` | tela interna |
| Erros de API | Envelopes padronizados | `lib/api-response.ts` |

## 2. Como configurar o Sentry

O Sentry é **totalmente opcional**. Sem `SENTRY_DSN`, a aplicação roda
normalmente e nenhum código do Sentry é ativado.

Para ligar:

1. Crie um projeto Next.js no [sentry.io](https://sentry.io).
2. Copie o DSN e preencha no `.env`:

   ```
   SENTRY_DSN="https://...@o000.ingest.sentry.io/000"
   NEXT_PUBLIC_SENTRY_DSN="https://...@o000.ingest.sentry.io/000"
   ```

3. (Opcional, só para upload de source maps em CI) preencha
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

### O que é enviado / o que NÃO é enviado

- `sendDefaultPii` é forçado para `false`.
- `beforeSend` (`lib/observability/sentry-options.ts`) remove `cookies` e os
  headers `Cookie`/`Authorization` de todo evento.
- O `lib/logger.ts` redige automaticamente chaves sensíveis (password, token,
  secret, cookie, authorization, hash, etc.) antes de logar ou enviar ao
  Sentry.
- Nunca são enviados: senha, token de sessão, `passwordHash`, `AUTH_SECRET`,
  cookies ou headers de autenticação.

### Limitação de build (Turbopack)

Este projeto usa Next.js 16 com Turbopack. A instrumentação é feita
manualmente via `Sentry.init()` guardado por DSN nos arquivos
`instrumentation*.ts`, **sem** o wrapper `withSentryConfig` no
`next.config.ts`. Isso mantém o build estável no Turbopack; a captura de
erros em runtime (server e client) funciona normalmente. O trade-off é que o
upload automático de source maps não está ativado — pode ser adicionado no
futuro quando o suporte do plugin do Sentry ao Turbopack estiver estável.

## 3. Variáveis de ambiente

Ver `.env.example`. Todas as variáveis de Sentry são opcionais:

```
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""
SENTRY_ORG=""
SENTRY_PROJECT=""
```

## 4. Testar /api/health

Endpoint leve, sem banco, ideal para monitoramento de uptime:

```bash
curl http://localhost:3000/api/health
```

```json
{
  "status": "ok",
  "timestamp": "2026-07-01T12:00:00.000Z",
  "environment": "development",
  "app": "Sinery System"
}
```

## 5. Testar /api/health/deep

Verifica o banco e retorna métricas básicas:

```bash
curl http://localhost:3000/api/health/deep
```

```json
{
  "status": "ok",
  "database": "ok",
  "clinicsCount": 1,
  "responseTimeMs": 12,
  "version": "0.1.0",
  "timestamp": "2026-07-01T12:00:00.000Z",
  "environment": "development"
}
```

Se o banco estiver fora do ar, responde **HTTP 503** com `status: "error"`,
`database: "error"` e uma mensagem segura (sem stack trace).

## 6. Como usar /status

Página protegida (requer login), acessível por qualquer papel autenticado.
Mostra, em cartões coloridos (verde/âmbar/vermelho):

- status da aplicação
- status do banco
- clínicas cadastradas
- tempo de resposta
- ambiente, versão e horário da última verificação
- botão **Atualizar status** (refaz a chamada a `/api/health/deep`)

## 7. Como usar /auditoria

Página protegida que lista os `AuditLog` **da clínica do usuário logado**.

- **Isolamento multi-tenant:** toda consulta é filtrada por `clinicId` do
  usuário — nunca aparecem logs de outra clínica.
- **Controle de acesso:** apenas `OWNER` e `ADMIN` acessam. `RECEPTIONIST` e
  `PROFESSIONAL` veem uma tela de "Acesso negado", e a tentativa é registrada
  como `ACCESS_DENIED`.
- **Filtros:** busca por texto na descrição, filtro por ação e por entidade.
- **Paginação:** 20 registros por página, com botões Anterior/Próxima (não
  carrega tudo de uma vez).
- Abrir a auditoria (página 1, sem filtros) registra um evento
  `AUDIT_LOG_VIEWED`. Paginar/filtrar não gera novos registros de visualização
  (evita poluir a trilha).

### Ações padronizadas (`lib/audit-actions.ts`)

`AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`,
`AUTH_PASSWORD_CHANGED`, `SYSTEM_HEALTH_CHECK`, `SYSTEM_DEEP_HEALTH_CHECK`,
`AUDIT_LOG_VIEWED`, `ACCESS_DENIED`, `PATIENT_CREATED`, `APPOINTMENT_CREATED`,
`CLINIC_CREATED`, `USER_CREATED`.

> `action` é uma coluna `string` no Prisma (não enum), para permitir novos
> tipos de evento sem migração de schema.

### Health checks e auditoria

`/api/health` e `/api/health/deep` **não** escrevem um `AuditLog` a cada
chamada — seria inviável para um endpoint batido a cada minuto por um monitor
externo. Eles usam apenas o `logger`. As ações `SYSTEM_HEALTH_CHECK` /
`SYSTEM_DEEP_HEALTH_CHECK` existem como constantes e aparecem como exemplos no
seed.

## 8. Configurar UptimeRobot (futuro)

1. Crie um monitor HTTP(s) no [UptimeRobot](https://uptimerobot.com).
2. Aponte para `https://SEU_DOMINIO/api/health`.
3. Intervalo sugerido: 1–5 minutos.
4. Considere um segundo monitor apontando para `/api/health/deep` para detectar
   falhas de banco (aceita 200; alerta em 503).

> `/api/health/deep` é público por enquanto e não expõe dados sensíveis. Em
> produção, pode ser protegido por um token em header ou por allowlist de IP
> (do monitor) — a implementação atual já isola qualquer dado de negócio.

## 9. O que ainda NÃO foi implementado

- Alertas automáticos por e-mail/WhatsApp
- Dashboards (Grafana) e métricas time-series
- OpenTelemetry / tracing distribuído completo
- Logs centralizados externos (ELK, Datadog, Loki, etc.)
- Alertas por cliente/clínica
- Página pública de status (status page voltada ao cliente final)
- Upload automático de source maps para o Sentry (ver limitação do Turbopack)
- Rate limiting / proteção por token em `/api/health/deep`
