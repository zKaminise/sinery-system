# Profissionais — Sinery System

Módulo real de gestão de profissionais implementado nos Prompts 07/08: CRUD
completo, horários de atendimento, vínculo com serviços e visualização
detalhada — base para o futuro módulo de Agenda.

## 1. O que o módulo faz

- Lista os profissionais da clínica atual em `/profissionais`, com cards de
  resumo (total, ativos, inativos, serviços vinculados na clínica).
- Busca por nome, telefone, e-mail ou especialidade (server-side).
- Filtro por status.
- Paginação (10 por página).
- Cadastro e edição via modal.
- Ativar/inativar.
- Página de detalhes em `/profissionais/[professionalId]` com dados
  cadastrais, horários de atendimento, serviços vinculados e um card
  preparado para consultas futuras.

Não há exclusão física de profissionais — apenas `status: INACTIVE`.

## 2. Permissões por role

| Ação | OWNER | ADMIN | RECEPTIONIST | PROFESSIONAL |
| --- | --- | --- | --- | --- |
| Listar / buscar / filtrar / ver detalhes | ✅ | ✅ | ✅ | ✅ (leitura) |
| Cadastrar profissional | ✅ | ✅ | ✅ | ❌ |
| Editar dados cadastrais | ✅ | ✅ | ✅ | ❌ |
| Ativar/inativar | ✅ | ✅ | ✅ | ❌ |
| Gerenciar horários de atendimento | ✅ | ✅ | ✅ | ❌ |
| Gerenciar serviços vinculados | ✅ | ✅ | ✅ | ❌ |

**Decisão de projeto:** assim como em Pacientes, OWNER/ADMIN/RECEPTIONIST têm
permissões idênticas sobre Profissionais — inclusive para ativar/inativar,
horários e vínculos — seguindo a mesma lógica operacional de uma recepção de
clínica pequena. `PROFESSIONAL` é somente leitura em toda esta área,
**mesmo sobre o próprio cadastro**: alterar dados, horários ou vínculos é
uma ação administrativa neste V1.

Toda tentativa sem permissão retorna 403 na API e gera um `AuditLog`
`PROFESSIONAL_ACCESS_DENIED`.

## 3. Como funcionam os horários de atendimento

Cada profissional pode ter vários blocos de horário por dia da semana (ex.:
Segunda 08:00–12:00 **e** 14:00–18:00). Campos: dia da semana, horário de
início, horário de término, ativo/inativo.

- `dayOfWeek` usa a mesma convenção do `Date#getDay()` do JavaScript:
  `0` = Domingo … `6` = Sábado. Na UI, os dias são exibidos em português e
  agrupados começando pela Segunda-feira (leitura mais natural para uma
  semana de trabalho), mas o valor armazenado continua no padrão 0–6.
- Diferente de Paciente/Usuário/Profissional/Serviço, um horário de
  atendimento **pode ser excluído fisicamente** — é apenas configuração
  operacional, não um evento clínico ou de auditoria de negócio. A exclusão
  ainda gera um `AuditLog` (`WORKING_HOUR_DELETED`).
- Ativar/inativar sem alterar dia/horário é registrado como
  `WORKING_HOUR_STATUS_CHANGED`; qualquer outra edição é `WORKING_HOUR_UPDATED`.

## 4. Regras contra sobreposição de horários

- `startTime` deve ser menor que `endTime`.
- `dayOfWeek` precisa ser um valor válido (0–6).
- **Não é permitida sobreposição entre horários ativos** do mesmo
  profissional no mesmo dia. Exemplo: se já existe Segunda 08:00–12:00, não é
  possível criar Segunda 11:00–15:00 (elas se sobrepõem), mas Segunda
  14:00–18:00 é permitido (blocos adjacentes/separados).
- A checagem considera apenas horários **ativos** — um horário inativado não
  bloqueia a criação de um novo horário no mesmo intervalo.
- A checagem é sempre re-executada no servidor (nunca confia em validação
  apenas do cliente) e escopada a `clinicId + professionalId`.

## 5. Regras de multi-tenant

- Todo profissional, horário e vínculo pertence obrigatoriamente a um
  `clinicId` — que **nunca vem do cliente**, sempre da sessão do usuário
  logado (`auth.user.clinicId`).
- Operações sensíveis sempre localizam o registro por **`id` + `clinicId`
  juntos**, nunca por `id` isolado.
- `/profissionais/[professionalId]` chama `notFound()` (404) quando o
  profissional não existe ou pertence a outra clínica — resposta idêntica
  nos dois casos, nunca revelando a existência do registro.
- Horários e vínculos de um profissional só podem ser gerenciados através de
  rotas que primeiro confirmam que o **profissional** pertence à clínica
  atual (e, no caso de vínculos, que o **serviço** também pertence).

## 6. Como funciona o vínculo com serviços

Existe uma tabela de junção `ProfessionalService` (muitos-para-muitos entre
`Professional` e `Service`), com unicidade em `(professionalId, serviceId)`
— não é possível vincular o mesmo serviço duas vezes ao mesmo profissional
(retorna 409). O vínculo é gerenciado principalmente pela tela de detalhes do
**profissional** (selecionar quais serviços ele realiza); a tela de detalhes
do **serviço** mostra a lista de profissionais vinculados em modo leitura, com
um link para a página de detalhes de cada um (a estrutura já está pronta caso
uma tela de "gerenciar profissionais" a partir do serviço seja adicionada
depois).

Ao vincular/desvincular, tanto o `professionalId` quanto o `serviceId` são
revalidados contra o `clinicId` da sessão — nunca é possível vincular um
serviço de outra clínica.

## 7. O que ainda NÃO foi implementado

- Agenda completa (esses módulos são a base; a agenda manual vem em um
  próximo prompt)
- Bloqueios especiais de agenda (feriados, eventos pontuais)
- Férias/ausências programadas
- Comissões por profissional
- Integração com Google Calendar
- Permissões granulares por profissional (ex.: um profissional editar apenas
  o próprio cadastro/horário)
