# Dashboard — Sinery System

`/dashboard` foi transformado no Prompt 10 de tela mockada em painel real de
indicadores operacionais da clínica logada.

## 1. O que o dashboard mostra na V1

- Saudação personalizada ("Bom dia/Boa tarde/Boa noite, {primeiro nome}") e
  identificação da clínica (nome, segmento, status).
- 8 cards de indicadores reais: consultas hoje, confirmadas hoje, aguardando
  confirmação, pacientes ativos, profissionais ativos, serviços ativos,
  cancelamentos da semana, faltas da semana.
- **Agenda de hoje**: consultas do dia, ordenadas por horário, com link para o
  detalhe em `/agenda/[id]`.
- **Próximas consultas**: até 6 consultas futuras (a partir de amanhã) em
  status não-terminal (`SCHEDULED`/`RESCHEDULED`/`CONFIRMED`).
- **Alertas operacionais**: lista dinâmica com problemas reais de configuração
  (ver seção 4).
- **Resumo da semana**: total, confirmadas, canceladas, concluídas e faltas
  da semana corrente, em barras proporcionais.
- **Sinery Assist em preparação**: contadores reais (não mockados) de
  atendimentos por IA, agendamentos por IA e conversas pendentes — hoje
  sempre 0, porque não há conversas/IA reais ainda.
- **Atalhos rápidos**: para pacientes, agenda, profissionais, serviços e
  auditoria, filtrados por permissão.

## 2. Como as métricas são calculadas

Toda a lógica vive em [`lib/dashboard/queries.ts`](../lib/dashboard/queries.ts),
em uma única função `getDashboardData(clinicId)` que roda todas as consultas
com `Promise.all` (sem N+1, sem waterfalls). Definições:

- **Aguardando confirmação** = status `SCHEDULED` ou `RESCHEDULED`.
- **Confirmadas** = status `CONFIRMED`.
- **Canceladas** = status `CANCELLED`.
- **Faltas** = status `NO_SHOW`.
- **Consultas hoje / confirmadas hoje / aguardando hoje**: filtradas pelo
  intervalo `[início do dia, início do dia seguinte)` no fuso da clínica.
- **Resumo da semana**: mesmo agrupamento (`groupBy` por status), mas para o
  intervalo da semana corrente (segunda a domingo, fuso da clínica).
- **"Cancelamentos nos últimos 7 dias"** (alerta) usa uma janela **rolante**
  de 7 dias a partir de agora — deliberadamente diferente do "canceladas da
  semana" do resumo, que usa a **semana de calendário** (segunda–domingo).
  São perguntas diferentes: o alerta responde "o que aconteceu recentemente",
  o resumo responde "como está indo esta semana".
- **Próximas consultas**: consultas com `startAt` a partir do início do dia
  seguinte a hoje, status não-terminal, limitadas a 6, ordenadas por data.
- **Sinery Assist**: `agendamentosPelaIA` conta `Appointment` com
  `createdBySource = "AI"` (campo real do schema); `atendimentosPelaIA` conta
  `Conversation`s com ao menos uma `Message` de `senderType = "AI"`;
  `conversasPendentes` conta `Conversation` com `status = "WAITING_HUMAN"`.
  Como nenhum desses modelos tem dados reais ainda (IA/WhatsApp não
  implementados), os três sempre retornam 0 — nunca são inventados.

## 3. Cálculo de "hoje" e "semana" (timezone)

O dashboard **reutiliza** os mesmos utilitários de timezone do módulo de
agenda (`lib/appointments/date-utils.ts`), em vez de duplicar lógica de data:
`clinicToday`, `getDayRangeUtc`, `getWeekRangeUtc`, `utcToClinicParts`. Isso
garante que uma consulta contada como "hoje" no dashboard é exatamente a
mesma que aparece em `/agenda` para o mesmo dia — não existem duas definições
de "hoje" divergentes no sistema. O fuso usado é
`ClinicSettings.timezone` (padrão `America/Sao_Paulo`); veja
[`docs/appointments.md`](./appointments.md) para os detalhes de conversão
(banco em UTC, exibição/cálculo em horário local da clínica).

## 4. Alertas operacionais

Cada alerta só aparece se a condição for verdadeira (nenhum dado fictício):

- **Aguardando confirmação**: `SCHEDULED`/`RESCHEDULED` com `startAt` a
  partir de agora (não conta consultas passadas e não confirmadas).
- **Canceladas nos últimos 7 dias**: ver seção 2.
- **Profissional sem horário cadastrado**: profissional `ACTIVE` sem nenhum
  `WorkingHour` ativo.
- **Profissional sem serviço vinculado**: profissional `ACTIVE` sem nenhum
  `ProfessionalService` apontando para um serviço `ACTIVE`.
- **Serviço sem profissional vinculado**: serviço `ACTIVE` sem nenhum
  `ProfessionalService` apontando para um profissional `ACTIVE`.
- **Pacientes arquivados**: contagem informativa, só exibida se > 0.

Se nenhuma condição for verdadeira, o card mostra "Nenhum alerta no momento.
Tudo em ordem." em vez de uma lista vazia sem contexto.

## 5. Permissões

O dashboard é visível para **todos os papéis autenticados**, incluindo
`PROFESSIONAL` (modo leitura). As métricas mostradas são da clínica inteira
na V1 — um dashboard por profissional (mostrando só as próprias consultas)
ficou fora de escopo, mesma decisão já tomada para `/agenda`
(ver [`docs/appointments.md`](./appointments.md)).

Os **atalhos rápidos** respeitam permissão:

| Atalho | OWNER/ADMIN/RECEPTIONIST | PROFESSIONAL |
| --- | --- | --- |
| Novo paciente | ✅ | ❌ |
| Nova consulta | ✅ | ❌ |
| Novo profissional | ✅ | ❌ |
| Novo serviço | ✅ | ❌ |
| Ver agenda | ✅ | ✅ |
| Ver auditoria | ✅ | ✅ |

Reutiliza os helpers já existentes em `lib/permissions.ts`
(`canCreatePatient`, `canCreateProfessional`, `canCreateService`,
`canManageAppointments`) — nenhum helper novo foi necessário.

## 6. Auditoria

Carregar o dashboard **não** gera `AuditLog` — isso poluiria a auditoria a
cada acesso. Não existe hoje um cenário de acesso negado no dashboard (todo
usuário autenticado pode vê-lo), então nenhuma ação `DASHBOARD_ACCESS_DENIED`
foi adicionada — seria código morto sem um caminho real que a dispare.

## 7. Fonte global (Inter)

Trocada a fonte do sistema inteiro para **Inter** via `next/font/google`
(`app/layout.tsx`), com fallback seguro
`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
Um bug pré-existente foi corrigido: `app/globals.css` definia
`--font-sans: var(--font-sans)` (auto-referência — nunca resolvia para a
fonte real), o que explicava a leitura ruim. Agora `--font-sans` aponta para
`var(--font-inter)` de verdade. Como a fonte é aplicada uma única vez em
`html { font-sans }` e herdada por toda a árvore (`body`, sidebar, header,
tabelas, formulários, cards, modais), a troca cobre o sistema inteiro sem
precisar tocar em cada tela.

## 8. Performance

Todas as consultas do dashboard rodam em paralelo via `Promise.all` dentro de
`getDashboardData`. Nenhuma lista carrega mais que 6 registros (consultas de
hoje não têm limite — é um único dia — e "próximas consultas" é limitado a
6). Contagens usam `count`/`groupBy` do Prisma em vez de carregar registros
completos para contar em memória.

## 9. O que ainda NÃO foi implementado

- Gráficos avançados (linhas, pizza, séries históricas)
- Filtros personalizados no dashboard (por profissional, por período)
- Metas da clínica
- Dados financeiros/faturamento
- Métricas reais de IA (Sinery Assist ainda não existe)
- Métricas reais de WhatsApp
- Dashboard por profissional (ver apenas as próprias consultas)
- Exportação de relatórios
