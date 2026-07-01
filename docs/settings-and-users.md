# Configurações e usuários — Sinery System

Área de administração da clínica implementada no Prompt 05: página
`/configuracoes` com dados da clínica, configurações operacionais, gestão de
usuários e informações de segurança.

## 1. Como funciona a página /configuracoes

Página protegida (requer login) dividida em 4 abas:

| Aba | Conteúdo | Quem edita |
| --- | --- | --- |
| **Clínica** | Nome, razão social, CPF/CNPJ, segmento, contatos, endereço, logo | OWNER / ADMIN |
| **Operação** | Fuso horário, expediente, intervalo de agendamento, limites da IA | OWNER / ADMIN |
| **Usuários** | Listagem e gestão de usuários da clínica | OWNER / ADMIN |
| **Segurança** | Dados da conta atual, notas de segurança, logout | Todos |

Todos os usuários autenticados **acessam** a página. As permissões controlam
o que é **editável**:

- **OWNER / ADMIN**: editam Clínica e Operação; acessam a aba Usuários.
- **RECEPTIONIST / PROFESSIONAL**: veem Clínica e Operação em **somente
  leitura**; a aba Usuários mostra uma mensagem de acesso negado.

O status da clínica (ACTIVE/SUSPENDED/…) é **somente leitura** — não é editável
pela própria clínica neste momento.

## 2. Quem pode editar a clínica

`OWNER` e `ADMIN`. A atualização é sempre feita na clínica do usuário logado
(`clinicId` da sessão) — nunca é possível editar outra clínica. Auditada como
`CLINIC_UPDATED`.

## 3. Quem pode editar a operação

`OWNER` e `ADMIN`. Regras de validação: o horário de início deve ser menor que
o de término, e o intervalo de agendamento deve ser positivo. Auditada como
`CLINIC_SETTINGS_UPDATED`.

> As opções da Sinery Assist (agendamento/remarcação/cancelamento por IA, tom)
> apenas **registram a preferência** — nenhuma automação de IA é executada
> ainda.

## 4. Quem pode gerenciar usuários

`OWNER` e `ADMIN`. `RECEPTIONIST` e `PROFESSIONAL` não têm acesso à aba
Usuários (tentativas server-side retornam 403; a UI mostra acesso negado).

A tabela mostra: nome, e-mail, função, status, se tem senha provisória,
primeiro login, última troca de senha, criação e ações.

Ações disponíveis: criar usuário, editar nome/função, ativar/inativar,
redefinir senha provisória.

## 5. Regras de OWNER e ADMIN

| Regra | Detalhe |
| --- | --- |
| Criação de funções | OWNER cria qualquer função; ADMIN cria apenas RECEPTIONIST/PROFESSIONAL |
| ADMIN × OWNER | ADMIN **não** pode criar, editar, inativar ou alterar um OWNER |
| ADMIN × ADMIN | ADMIN **não** pode criar outro ADMIN nem promover a ADMIN |
| Auto-inativação | Ninguém pode inativar a si mesmo |
| Último proprietário | Não é possível inativar (ou rebaixar) o **último OWNER ativo** da clínica |
| E-mail | Único **por clínica** (o mesmo e-mail pode existir em outra clínica) |
| Exclusão | Não há exclusão física — apenas status `INACTIVE` |

**Decisão de projeto — ADMIN não cria/promove ADMIN:** para evitar escalonamento
de privilégio, a criação e promoção a `ADMIN` (e `OWNER`) é intencionalmente
exclusiva do `OWNER`. Um ADMIN gerencia a operação do dia a dia
(recepção/profissionais), mas não expande o círculo administrativo.

Eventos auditados: `USER_CREATED`, `USER_UPDATED`, `USER_ROLE_CHANGED`,
`USER_STATUS_CHANGED`, `USER_TEMP_PASSWORD_RESET`, `USER_ACCESS_DENIED`.
Nenhum log/auditoria contém senha, hash, token ou cookie.

## 6. Como funciona a senha provisória

- Ao **criar** um usuário ou **redefinir** a senha, o servidor gera uma senha
  forte no formato `Sinery@` + 8 caracteres aleatórios seguros
  (`crypto.randomInt`, sem caracteres ambíguos).
- Apenas o **hash bcrypt** é salvo; o texto puro é retornado **uma única vez**
  e exibido em um modal com aviso: *"Essa senha será exibida apenas uma vez.
  Copie e envie para o usuário de forma segura."*
- O usuário recebe `temporaryPassword: true` e, no primeiro login, é
  redirecionado para `/alterar-senha` (fluxo do Prompt 03, preservado).
- A senha provisória **nunca** aparece em console, Sentry, AuditLog ou
  metadata.

Senha provisória de desenvolvimento (seed): **`Sinery@123`** — vale apenas para
os usuários criados pelo seed em ambiente local. Nunca usar em produção.

Usuários do seed:

| Nome | E-mail | Função |
| --- | --- | --- |
| Gabriel Admin | admin@sorriaodonto.com.br | OWNER |
| Mariana Recepção | recepcao@sorriaodonto.com.br | RECEPTIONIST |
| Dr. Felipe | felipe@sorriaodonto.com.br | PROFESSIONAL |

## 7. Por que não existe exclusão física de usuários

Excluir um usuário fisicamente apagaria (ou órfãaria) referências históricas —
agendamentos criados, conversas atribuídas e trilha de auditoria. Em vez disso,
usuários são **inativados** (`status: INACTIVE`): perdem o acesso imediatamente
(o login e a resolução de sessão bloqueiam usuários não-ACTIVE), mas o histórico
permanece íntegro e auditável.

## 8. O que ainda NÃO foi implementado

- Convite de usuários por e-mail
- Recuperação de senha por e-mail
- Autenticação de dois fatores (2FA)
- Troca voluntária de senha pelo próprio usuário logado
- Permissões granulares avançadas (por recurso/ação)
- Gestão de múltiplas unidades por clínica
- Envio real de e-mail

## Arquitetura (resumo)

- **API Routes** (coerente com o padrão de auth): `app/api/settings/clinic`,
  `.../operation`, `.../users` (POST), `.../users/[userId]` (PATCH:
  `action=update|status`), `.../users/[userId]/reset-password` (POST).
- **Validação**: Zod em `lib/validators/settings.ts`.
- **Permissões**: `lib/permissions.ts` (`canManageClinicSettings`,
  `canManageUsers`, `canEditUserRole`, `canDeactivateUser`, `assignableRoles`
  etc.) — usadas tanto no servidor (autoritativo) quanto para ocultar ações na
  UI.
- **Segurança de sessão**: cada rota usa `requireApiUser` (`lib/api-auth.ts`),
  valida a role e escopa toda operação ao `clinicId` do usuário logado.
- **Auditoria**: `createAuditLog` (helper do Prompt 04).
- **UI**: `app/(app)/configuracoes/page.tsx` (server) + componentes client em
  `components/settings/*`, com toasts (`sonner`), badges e modais.
