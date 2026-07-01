# Pacientes — Sinery System

Módulo real de gestão de pacientes implementado no Prompt 06: listagem com
busca/filtros/paginação, cadastro, edição, visualização detalhada e
arquivamento — tudo escopado à clínica do usuário logado.

## 1. O que o módulo faz na V1

- Lista os pacientes da clínica atual em `/pacientes`, com cards de resumo
  (total, ativos, inativos, arquivados).
- Busca por nome, telefone, e-mail ou documento (server-side, via query
  params na URL).
- Filtros por status e por origem.
- Paginação (10 por página, botões Anterior/Próxima).
- Cadastro e edição via modal (`Novo paciente` / `Editar`).
- Ativar/inativar (alterna `ACTIVE` ⇄ `INACTIVE`) e arquivar (`ARCHIVED`).
- Página de detalhes em `/pacientes/[patientId]` com todos os dados, um card
  de observações administrativas e um card de "Histórico do paciente"
  (lista os agendamentos existentes, quando houver; caso contrário mostra um
  aviso de que o histórico completo chega em etapas futuras).

Não há exclusão física — apenas o status `ARCHIVED` (ver seção 5).

## 2. Permissões por role

| Ação | OWNER | ADMIN | RECEPTIONIST | PROFESSIONAL |
| --- | --- | --- | --- | --- |
| Listar / buscar / filtrar | ✅ | ✅ | ✅ | ✅ |
| Ver detalhes (inclusive observações) | ✅ | ✅ | ✅ | ✅ (leitura) |
| Cadastrar paciente | ✅ | ✅ | ✅ | ❌ |
| Editar dados cadastrais | ✅ | ✅ | ✅ | ❌ |
| Ativar/inativar | ✅ | ✅ | ✅ | ❌ |
| Arquivar | ✅ | ✅ | ✅ | ❌ |

**Decisão de projeto:** OWNER, ADMIN e RECEPTIONIST têm permissões idênticas
sobre pacientes neste V1 (o prompt permite explicitamente que RECEPTIONIST
arquive, desde que fique registrado em auditoria — o que fazemos). Não há
distinção granular por campo (ex.: "RECEPTIONIST só edita dados básicos") —
isso pode ser refinado depois se surgir uma necessidade real. PROFESSIONAL é
somente leitura em toda a área de pacientes, incluindo as observações
administrativas (pode ler, não pode editar).

Toda tentativa de ação sem permissão retorna 403 na API e gera um
`AuditLog` `PATIENT_ACCESS_DENIED`.

## 3. Regras de multi-tenant

- Todo paciente pertence obrigatoriamente a um `clinicId`.
- **O `clinicId` nunca vem do cliente/frontend** — toda operação usa
  `auth.user.clinicId`, resolvido a partir da sessão do usuário logado.
- Buscas/listagens: `where: { clinicId: user.clinicId, ... }`.
- Operações sensíveis (editar, mudar status): sempre localizam o registro por
  **`id` + `clinicId` juntos** (`findFirst({ where: { id, clinicId } })`),
  nunca por `id` isolado. Se o paciente pertence a outra clínica, o registro
  simplesmente "não existe" do ponto de vista do usuário atual.
- `/pacientes/[patientId]` chama `notFound()` (404 do Next.js) quando o
  paciente não existe ou pertence a outra clínica — a resposta é idêntica
  nos dois casos, então nunca revela que o id pertence a alguém.

## 4. Campos disponíveis

| Campo | Obrigatório | Observações |
| --- | --- | --- |
| Nome | Sim | Mínimo 2 caracteres |
| Telefone | Sim | Normalizado para apenas dígitos ao salvar |
| E-mail | Não | Validado se informado; salvo em minúsculas |
| CPF/documento | Não | Texto livre, sem validação de CPF/CNPJ |
| Data de nascimento | Não | — |
| Origem | Não | Select: WhatsApp, Instagram, Indicação, Google, Site, Retorno, Outro |
| Observações | Não | Até 2000 caracteres; uso administrativo, não é prontuário clínico |
| Status | — | `ACTIVE` (padrão na criação), `INACTIVE`, `ARCHIVED` — alterado apenas pela ação dedicada, nunca pelo formulário de edição |

## 5. Como funciona o arquivamento

Pacientes nunca são excluídos fisicamente do banco. Para remover um paciente
da operação ativa, ele é movido para o status `ARCHIVED` (ação "Arquivar").
Um paciente arquivado:

- some das telas de trabalho por padrão quando não há filtro de status
  aplicado explicitamente (ele conta no card "Arquivados" e aparece se o
  filtro `status=ARCHIVED` for selecionado);
- deixa de ter ações de edição/status disponíveis na tabela e nos detalhes
  (a linha/página mostra só o badge, sem botões de ação);
- mantém todo o histórico (agendamentos, auditoria) intacto.

Isso preserva o histórico clínico/administrativo e a trilha de auditoria, ao
custo de nunca "esvaziar" a tabela `Patient` — uma troca deliberada para um
sistema de saúde, onde apagar um cadastro é raramente a operação certa.

## 6. O que ainda NÃO foi implementado

- Prontuário clínico/odontológico (o campo "Observações" é só administrativo)
- Anexos/upload de arquivos (exames, imagens, documentos)
- Histórico completo de consultas (a V1 lista os agendamentos existentes de
  forma simples; não há linha do tempo, evolução clínica ou anotações por
  consulta)
- Importação de pacientes por planilha
- Consentimentos/LGPD avançado (termo de consentimento, portabilidade,
  exclusão sob demanda)
- Integração real com WhatsApp
- Merge/deduplicação de pacientes duplicados

## Arquitetura (resumo)

Segue exatamente o padrão estabelecido no Prompt 05: **API Routes**
(`app/api/patients/route.ts` para criar, `app/api/patients/[patientId]/route.ts`
para editar, `.../status/route.ts` para ativar/inativar/arquivar), cada uma
usando `requireApiUser()` + Zod (`lib/validators/patient.ts`) + permissões
(`lib/permissions.ts`) + `createAuditLog`. A listagem (`/pacientes`) e os
detalhes (`/pacientes/[patientId]`) são Server Components com consultas
Prisma diretas (mesmo padrão usado em `/auditoria`), evitando uma rota GET
adicional só para leitura. Componentes client (`components/patients/*`) só
cuidam de filtros, formulário e ações — sempre revalidando via
`router.refresh()` após qualquer mutação.
