# Serviços — Sinery System

Módulo real de gestão de serviços/procedimentos implementado nos Prompts
07/08: CRUD completo, vínculo com profissionais e visualização detalhada —
base para o futuro módulo de Agenda.

## 1. O que o módulo faz

- Lista os serviços da clínica atual em `/servicos`, com cards de resumo
  (total, ativos, inativos, duração média de todos os serviços da clínica).
- Busca por nome ou descrição (server-side).
- Filtro por status e por duração (15/30/45/60/90/120 minutos).
- Paginação (10 por página).
- Cadastro e edição via modal.
- Ativar/inativar.
- Página de detalhes em `/servicos/[serviceId]` com dados, descrição e a
  lista de profissionais vinculados (leitura).

Não há exclusão física de serviços — apenas `status: INACTIVE`.

## 2. Campos disponíveis

| Campo | Obrigatório | Observações |
| --- | --- | --- |
| Nome | Sim | Mínimo 2 caracteres |
| Duração (minutos) | Sim | Inteiro entre 5 e 480. A UI sugere 15/30/45/60/90/120 |
| Descrição | Não | Até 1000 caracteres |
| Preço estimado | Não | Não pode ser negativo |
| Status | — | `ACTIVE` (padrão na criação) ou `INACTIVE`, alterado só pela ação dedicada |

## 3. Como o preço é armazenado

O campo `Service.priceInCents` no banco é sempre um inteiro em **centavos**
(ex.: `15000` = R$ 150,00), evitando problemas de arredondamento com números
de ponto flutuante. A UI, porém, sempre trabalha em **reais** — o formulário
pede "150.00" e a conversão (`Math.round(priceInReais * 100)`) acontece
**apenas na API**, nunca no schema Zod nem no cliente. A listagem e os
detalhes exibem o valor formatado como moeda brasileira (`R$ 150,00`) via
`Intl.NumberFormat`. Um serviço sem preço definido mostra "Não informado".

**Nenhuma cobrança real é feita** — o preço é puramente informativo, para uso
futuro em orçamento/agenda.

## 4. Como a duração será usada pela agenda

`durationMinutes` já está pronto para o próximo módulo de Agenda: ao agendar
uma consulta para um determinado serviço, a duração do serviço definirá o
bloco de tempo ocupado na agenda do profissional (combinado com os horários
de atendimento do módulo de Profissionais). Nada disso é executado ainda
neste prompt — os dados só estão estruturados e disponíveis.

## 5. Como funciona o vínculo com profissionais

Serviços participam da mesma tabela de junção `ProfessionalService` descrita
em `docs/professionals.md`. A tela de detalhes do serviço mostra, em modo
leitura, a lista de profissionais vinculados (com link para o perfil de cada
um) e a contagem aparece na listagem — mas **o vínculo em si é gerenciado a
partir da tela de detalhes do profissional**, para evitar duplicar a mesma
funcionalidade em dois lugares nesta V1.

## 6. Permissões por role

| Ação | OWNER | ADMIN | RECEPTIONIST | PROFESSIONAL |
| --- | --- | --- | --- | --- |
| Listar / buscar / filtrar / ver detalhes | ✅ | ✅ | ✅ | ✅ (leitura) |
| Cadastrar serviço | ✅ | ✅ | ✅ | ❌ |
| Editar dados | ✅ | ✅ | ✅ | ❌ |
| Ativar/inativar | ✅ | ✅ | ✅ | ❌ |
| Gerenciar profissionais vinculados | ✅ | ✅ | ✅ | ❌ |

Mesma lógica de Pacientes e Profissionais: OWNER/ADMIN/RECEPTIONIST têm
acesso total; `PROFESSIONAL` é somente leitura. Toda tentativa sem
permissão retorna 403 e gera um `AuditLog` `SERVICE_ACCESS_DENIED`.

## 7. O que ainda NÃO foi implementado

- Cobrança real / integração de pagamento
- Pacotes de serviços (combos)
- Orçamento odontológico formal
- Categorias de serviço (agrupamento visual)
- Regras avançadas por serviço (ex.: pré-requisitos, serviços exclusivos de
  determinada especialidade)
