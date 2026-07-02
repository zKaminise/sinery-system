# Agenda (consultas) — Sinery System

Módulo real de agenda manual implementado no Prompt 09: criar, visualizar
(dia/semana/lista), remarcar, confirmar, cancelar, concluir e marcar falta em
consultas, respeitando pacientes, profissionais, serviços, horários de
atendimento, vínculos e isolamento multi-tenant.

## 1. O que o módulo faz na V1

- `/agenda` com três visualizações: **Dia**, **Semana** e **Lista**.
- Cards de resumo do dia (hoje, confirmadas, aguardando, canceladas, faltas).
- Filtros por profissional, status e busca (paciente/profissional/serviço),
  todos server-side via query params.
- Criar consulta manual (modal), com serviço opcional e cálculo automático do
  horário final a partir da duração do serviço (ou do intervalo padrão da
  clínica quando não há serviço).
- Editar/remarcar consulta.
- Ações de status: confirmar, cancelar, concluir, marcar falta.
- Página de detalhe `/agenda/[appointmentId]`.
- Paginação no modo lista (20/página).

## 2. Permissões por role

| Ação | OWNER | ADMIN | RECEPTIONIST | PROFESSIONAL |
| --- | --- | --- | --- | --- |
| Visualizar agenda (dia/semana/lista + detalhe) | ✅ | ✅ | ✅ | ✅ |
| Criar consulta | ✅ | ✅ | ✅ | ❌ |
| Editar / remarcar | ✅ | ✅ | ✅ | ❌ |
| Confirmar / cancelar / concluir / marcar falta | ✅ | ✅ | ✅ | ❌ |

**Decisão de projeto:** `PROFESSIONAL` é somente leitura na V1 — vê **toda** a
agenda da clínica (não apenas as próprias consultas), para consciência
operacional, mas não realiza mutações. "Ver apenas as próprias" foi
considerado e deliberadamente adiado (exigiria vincular `User` ↔
`Professional`, o que ainda não existe). Toda mutação sem permissão retorna
403 e gera um `AuditLog` `APPOINTMENT_ACCESS_DENIED`. As permissões são
validadas no servidor, nunca apenas escondendo botões.

## 3. Validação de horário de atendimento

Uma consulta só é aceita se o intervalo `[início, fim)` couber **inteiramente**
dentro de um bloco `WorkingHour` **ativo** do profissional, no dia da semana
correspondente. Exemplo (profissional atende segunda 08:00–12:00):

- 09:00–10:00 → válida
- 11:30–12:30 → inválida (ultrapassa o fim do bloco)
- 07:30–08:30 → inválida (começa antes do bloco)

Erro exibido: *"Este profissional não atende neste horário."* A comparação usa
o horário de parede (wall-clock "HH:mm") no fuso da clínica, então dispensa
matemática de timezone.

## 4. Validação de conflito

Duas consultas conflitam quando `existente.startAt < novo.endAt` **e**
`existente.endAt > novo.startAt`, para o **mesmo profissional**. Apenas
consultas em status **bloqueante** contam:

- Bloqueiam: `SCHEDULED`, `CONFIRMED`, `RESCHEDULED`
- Não bloqueiam: `CANCELLED`, `COMPLETED`, `NO_SHOW`

Ou seja, é possível agendar no mesmo horário de uma consulta cancelada. Ao
**editar**, a própria consulta é ignorada na checagem (`excludeAppointmentId`).
Erro exibido: *"Já existe uma consulta para este profissional nesse horário."*

## 5. Vínculo profissional-serviço

Se um serviço for informado, ele precisa: pertencer à clínica, estar `ACTIVE`,
e o profissional precisa estar **vinculado** a ele (tabela
`ProfessionalService`). Caso contrário: *"Este profissional não realiza o
serviço selecionado."* No formulário, ao escolher o profissional, o seletor de
serviços mostra **apenas** os serviços ativos vinculados a ele; se não houver
nenhum, aparece *"Este profissional ainda não possui serviços vinculados."*
O serviço é **opcional** — uma consulta pode ser criada sem serviço, e nesse
caso a duração padrão vem de `ClinicSettings.appointmentSlotMinutes`.

## 6. Status da consulta

`AppointmentStatus`: `SCHEDULED`, `CONFIRMED`, `CANCELLED`, `RESCHEDULED`,
`COMPLETED`, `NO_SHOW`.

Máquina de estados da V1 (`lib/appointments/availability.ts`):

| De | Pode ir para |
| --- | --- |
| SCHEDULED | CONFIRMED, CANCELLED, COMPLETED, NO_SHOW |
| RESCHEDULED | CONFIRMED, CANCELLED, COMPLETED, NO_SHOW |
| CONFIRMED | CANCELLED, COMPLETED, NO_SHOW |
| CANCELLED | — (terminal) |
| COMPLETED | — (terminal) |
| NO_SHOW | — (terminal) |

- Criar → status inicial `SCHEDULED`, `createdBySource = USER`,
  `createdByUserId = usuário atual`.
- Editar mudando data/horário/profissional → status vira `RESCHEDULED` e gera
  `APPOINTMENT_RESCHEDULED` (além de `APPOINTMENT_UPDATED`).
- Consultas em status **terminal** (`CANCELLED`/`COMPLETED`/`NO_SHOW`) não
  podem ser editadas: *"Não é possível editar uma consulta concluída,
  cancelada ou marcada como falta."*

## 7. Timezone na V1

- O banco armazena `startAt`/`endAt` como **instantes UTC** (Prisma `DateTime`).
- Toda entrada e exibição usa o fuso da clínica
  (`ClinicSettings.timezone`, padrão `America/Sao_Paulo`).
- O formulário envia componentes de parede: `date` ("YYYY-MM-DD") +
  `startTime`/`endTime` ("HH:mm") em horário local da clínica. Validações de
  horário de atendimento e dia da semana rodam direto nesses valores; só para
  gravar e detectar conflito eles são convertidos em instantes UTC via
  `zonedWallClockToUtc` (usa `Intl`, ciente de horário de verão, sem
  biblioteca externa). Para exibir, os instantes voltam ao fuso da clínica.
- Regra única: **entrada/exibição = fuso da clínica; armazenamento = UTC.**
  Multi-timezone por clínica está fora de escopo na V1. Ver
  `lib/appointments/date-utils.ts`.

## 8. Regras de multi-tenant

- Toda consulta pertence a um `clinicId`, sempre obtido da sessão — nunca do
  cliente.
- Todas as queries e mutações filtram por `clinicId` do usuário logado.
- Editar/status localizam a consulta por **`id` + `clinicId`** juntos.
- Paciente, profissional e serviço referenciados são **revalidados** contra a
  mesma clínica ao criar/editar — impossível agendar com registros de outra
  clínica.
- `/agenda/[appointmentId]` retorna `notFound()` (404) para consulta
  inexistente ou de outra clínica — resposta idêntica nos dois casos, nunca
  revelando a existência do registro.

## 9. O que ainda NÃO foi implementado

- IA criando/gerenciando consultas (Sinery Assist)
- WhatsApp confirmando/remarcando/lembrando
- Integração com Google Calendar
- Recorrência de consultas
- Bloqueios especiais de agenda, férias/ausências de profissionais
- Sala/equipamento como recurso agendável
- Fila de espera
- Confirmação automática e lembretes automáticos
- Prontuário clínico vinculado à consulta
