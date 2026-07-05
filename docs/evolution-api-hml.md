# Evolution API em HML — Sinery System

Guia da integração **Evolution API** usada em **HML/testes** para exercitar o fluxo
real de WhatsApp com um número interno, sem depender da aprovação/complexidade da
Meta Cloud API. **Produção continua na API oficial da Meta.**

> ⚠️ A Evolution API é **apenas para HML/testes**. Não use com clientes pagantes.

## 1. Por que Evolution em HML
- Permite conectar um número de WhatsApp comum via QR Code/pairing e testar o fluxo
  ponta a ponta (receber, Assist, responder) sem o processo de aprovação da Meta.
- Rápida de subir para validação interna.

## 2. Por que Meta oficial em produção
- API oficial, estável, suportada, com templates e conformidade.
- A Evolution não é oficial: pode desconectar, instabilizar e há risco de bloqueio do número.

## 3. Arquitetura
```
WhatsApp → Evolution API → (webhook) → Sinery → Sinery Assist → Evolution API → WhatsApp
```
O provider Evolution só **transporta** mensagem. A agenda, conflitos, clinicId e
permissões continuam validados no backend do Sinery (mesmo motor da Assist).

## 4. Como obter uma Evolution API
- Suba uma instância da Evolution API **fora deste repositório** (VPS/Render/Railway/etc.).
  Este prompt **não** instala nem configura servidor Evolution.
- Você precisará da **URL base**, de uma **API key** e de um **instance name**.

## 5. Envs no Sinery (HML)
```
APP_ENV=staging
MESSAGING_PROVIDER=evolution
EVOLUTION_API_ENABLED=true
EVOLUTION_API_URL=https://sua-evolution-api-hml.com
EVOLUTION_API_KEY=<sua-api-key>              # server-only, nunca no client
EVOLUTION_INSTANCE_NAME=sinery-hml
EVOLUTION_WEBHOOK_SECRET=<segredo-aleatorio>  # server-only
EVOLUTION_WEBHOOK_ENABLED=true
EVOLUTION_SEND_MESSAGES_ENABLED=true
EVOLUTION_SEND_MOCK_MODE=false
EVOLUTION_AUTO_PROCESS_ASSIST=true
EVOLUTION_ASSIST_REPLY_ENABLED=true
EVOLUTION_ALLOW_IN_PRODUCTION=false
```

### O que é cada env
- **EVOLUTION_API_URL** — URL base da sua Evolution API.
- **EVOLUTION_API_KEY** — chave da Evolution (header `apikey`). **Server-only.**
- **EVOLUTION_INSTANCE_NAME** — nome da instância; resolve **uma única clínica** no Sinery.
- **EVOLUTION_WEBHOOK_SECRET** — segredo que o Sinery valida no webhook (header ou query token). **Server-only.**

## 6. Configurar o webhook na Evolution
Aponte o webhook da instância para:
```
https://hml.app.sinery.com.br/api/webhooks/evolution?token=<EVOLUTION_WEBHOOK_SECRET>
```
Alternativamente, se a sua Evolution suportar header customizado, envie:
```
x-sinery-evolution-secret: <EVOLUTION_WEBHOOK_SECRET>
```
Eventos a habilitar: **MESSAGES_UPSERT / messages.upsert** (ou equivalente). O parser
é tolerante e aceita variações de versão/formato.

## 7. Conectar o número
Conecte o número de teste na instância Evolution por **QR Code / pairing** (na UI da
sua Evolution). O número real vem da Evolution/inbound — **nunca** é hardcodado no código.

> Número de teste de exemplo (apenas HML): `34991429784` → normalizado para envio: `5534991429784`.

## 8. Como testar
- **Receber:** envie um WhatsApp para o número conectado → confira a conversa em `/conversas`.
- **Assist:** com `EVOLUTION_AUTO_PROCESS_ASSIST=true` a Assist responde (ex.: "quero marcar limpeza amanhã").
- **Enviar:** responda pelo inbox humano → o Sinery envia via Evolution (`/message/sendText/{instance}`).
- **Humano assume:** ao responder como humano, a conversa vira HUMAN_HANDLING e a **Assist cala**.
- **Devolver para Assist:** use o botão de retornar para a Assist → ela volta a responder.

## 9. IA da Assist em HML
A Assist reutiliza o **mesmo motor** (`processAssistMessage`), então em HML ela pode rodar em:
1. **rule-based/mock** (`ASSIST_USE_REAL_AI=false`) — determinística, sem custo;
2. **OpenAI real** (`ASSIST_USE_REAL_AI=true` + `OPENAI_API_KEY`) — respeitando guardrails,
   rate limits e AiSettings. Mensagens sensíveis transferem para humano.

## 10. Segurança
- `EVOLUTION_API_KEY` e `EVOLUTION_WEBHOOK_SECRET` são **server-only** (nunca no client/bundle/logs).
- Webhook valida o segredo (header `x-sinery-evolution-secret` **ou** `?token=`), timing-safe.
- `clinicId` **nunca** vem do webhook — a clínica é resolvida pelo **instanceName** (uma instância → uma clínica).
- `fromMe=true` e grupos `@g.us` são ignorados. Payload desconhecido é ignorado com 200 (não quebra).
- Idempotência por `MessagingWebhookEvent.payloadHash` + `AssistProcessingRun` (uma resposta por inbound).
- Telefones mascarados em auditoria; nenhum payload bruto ou secret é gravado.

## 11. Riscos da Evolution
- Não é a API oficial da Meta.
- Pode desconectar / instabilizar.
- Risco de bloqueio do número.
- **Não recomendada para produção / cliente pagante.**

## 12. Plano futuro
Migrar produção para a **Meta WhatsApp Cloud API** oficial (já implementada e preservada).
Em produção, `MESSAGING_PROVIDER=meta_cloud` e a Evolution fica **bloqueada** por padrão
(`EVOLUTION_ALLOW_IN_PRODUCTION=false`; o readiness gera critical issue se alguém tentar ligar).

## 13. Sentry (opcional em HML)
O Sentry é **opcional**: com `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` vazios, o app roda
normalmente (init é pulado). O setup é manual e DSN-guarded (não usa `withSentryConfig`),
com scrubbing de cookies/headers — **não** enviamos PII/mensagens completas. Ver
[observability.md](./observability.md).

## 14. Testes manuais (mock local)
Ver [staging-test-plan.md](./staging-test-plan.md) → seção "Evolution (local mock)".
