# Conversas (central de atendimento) — Sinery System

Painel interno de atendimento implementado no Prompt 11. Prepara a base para
WhatsApp e Sinery Assist, mas **sem IA real e sem WhatsApp real** ainda.

## 1. O que o módulo faz na V1

- `/conversas` em layout de inbox (lista + thread + painel de detalhes).
- Listagem de conversas da clínica atual com busca, filtros e paginação.
- Visualização da conversa com histórico de mensagens em balões.
- Envio de mensagens humanas (simuladas — não saem para fora do sistema).
- Criação manual de "conversa de teste interna".
- Ações: assumir, transferir para humano, devolver para Sinery Assist,
  encerrar, reabrir e atribuir responsável.
- Cards de resumo (abertas, aguardando humano, em atendimento, com Sinery
  Assist, encerradas na semana).
- Audit logs para todas as ações e mensagens.

## 2. INTERNAL_SIMULATOR vs WHATSAPP

O schema já prevê dois canais (`ConversationChannel`):

- **INTERNAL_SIMULATOR** — canal de **teste interno**. Todas as conversas
  criadas nesta V1 usam este canal. As mensagens ficam apenas no banco da
  clínica; **nada é enviado para fora**. Serve para validar o fluxo de
  atendimento (assumir, responder, encerrar) antes de qualquer integração.
- **WHATSAPP** — reservado para a futura integração real. O módulo já lê e
  exibe este canal (o filtro de canal o inclui), mas **nenhuma mensagem de
  WhatsApp real é enviada ou recebida** nesta etapa.

## 3. WhatsApp real ainda NÃO foi implementado

Não há WhatsApp Cloud API, webhook de recebimento, nem envio externo. O botão
"Nova conversa de teste" cria uma conversa `INTERNAL_SIMULATOR` com uma
mensagem simulada do paciente — é explicitamente uma **conversa de teste
interna**, não um contato real de WhatsApp.

## 4. IA (Sinery Assist) real ainda NÃO foi implementada

O status `AI_HANDLING` e o rótulo "Sinery Assist" apenas **simulam** o fluxo
futuro. Nenhuma IA processa mensagens, classifica intenção ou responde. As
mensagens `AI` que aparecem no seed são **demonstração**. "Devolver para Sinery
Assist" apenas muda o status e registra uma mensagem de sistema — não dispara
automação.

## 5. Status da conversa

`ConversationStatus`:

- **AI_HANDLING** — marcada como atendida pela futura Sinery Assist (status
  visual, sem IA real).
- **WAITING_HUMAN** — aguardando atendimento humano.
- **HUMAN_HANDLING** — assumida por um atendente humano.
- **CLOSED** — encerrada.

### Transições permitidas (`lib/conversations/constants.ts`)

| De | Pode ir para |
| --- | --- |
| AI_HANDLING | WAITING_HUMAN, HUMAN_HANDLING, CLOSED |
| WAITING_HUMAN | HUMAN_HANDLING, CLOSED |
| HUMAN_HANDLING | AI_HANDLING, WAITING_HUMAN, CLOSED |
| CLOSED | WAITING_HUMAN, HUMAN_HANDLING (via reabrir) |

### Ações e efeitos

| Ação | Novo status | Responsável | Mensagem de sistema |
| --- | --- | --- | --- |
| Assumir | HUMAN_HANDLING | usuário atual | "Atendimento assumido por {nome}." |
| Transferir para humano | WAITING_HUMAN | limpo (null) | "Conversa transferida para atendimento humano." |
| Devolver para Sinery Assist | AI_HANDLING | limpo (null) | "Conversa devolvida para Sinery Assist. A automação real será implementada nas próximas etapas." |
| Encerrar | CLOSED | — | "Conversa encerrada." |
| Reabrir | WAITING_HUMAN | limpo (null) | "Conversa reaberta e aguardando atendimento humano." |
| Atribuir responsável | HUMAN_HANDLING | usuário escolhido | "Atendimento atribuído a {nome}." |

**Auto-assumir ao responder:** ao enviar uma mensagem humana em uma conversa
`WAITING_HUMAN` ou `AI_HANDLING`, ela passa automaticamente para
`HUMAN_HANDLING` com o remetente como responsável (registra `CONVERSATION_TAKEN`
+ `MESSAGE_SENT`).

## 6. Permissões por role

| Ação | OWNER | ADMIN | RECEPTIONIST | PROFESSIONAL |
| --- | --- | --- | --- | --- |
| Listar / visualizar / ler mensagens | ✅ | ✅ | ✅ | ✅ |
| Criar conversa de teste | ✅ | ✅ | ✅ | ❌ |
| Enviar mensagem | ✅ | ✅ | ✅ | ❌ |
| Assumir / transferir / devolver / encerrar / reabrir | ✅ | ✅ | ✅ | ❌ |
| Atribuir a **outro** usuário | ✅ | ✅ | ❌ | ❌ |
| Atribuir a si mesmo (via "assumir") | ✅ | ✅ | ✅ | ❌ |

`PROFESSIONAL` é **somente leitura**: vê o inbox e as threads, mas não vê
caixa de resposta nem botões de ação, e **toda mutação é bloqueada no
servidor** (403 + `CONVERSATION_ACCESS_DENIED`), não apenas escondida na UI.
Atribuir a um usuário arbitrário é ação de OWNER/ADMIN; a recepção se
auto-atribui via "assumir".

## 7. Regras de multi-tenant

- Toda `Conversation` e `Message` pertence a um `clinicId`, sempre obtido da
  sessão — nunca do cliente.
- Todas as queries filtram por `clinicId` do usuário logado.
- Buscar/alterar conversa localiza por **`id` + `clinicId`** juntos.
- Paciente vinculado e usuário atribuído são revalidados contra a mesma
  clínica.
- Conversa de outra clínica retorna **404** (nas rotas de mensagem/ação) ou
  simplesmente não aparece (na lista/thread) — a existência nunca é revelada.

## 8. Como criar uma conversa de teste

1. Em `/conversas`, clique em **Nova conversa de teste**.
2. Opcionalmente escolha um paciente (nome/telefone vêm do cadastro). Sem
   paciente, informe nome e telefone do contato.
3. Escreva a mensagem inicial do paciente e escolha o status inicial.
4. Ao criar: uma `Conversation` (canal `INTERNAL_SIMULATOR`), uma mensagem de
   sistema ("Conversa de teste interna criada.") e a mensagem
   `INBOUND`/`PATIENT` são gravadas. Audit: `CONVERSATION_CREATED` +
   `MESSAGE_RECEIVED_SIMULATED`.

## 9. Como enviar uma mensagem simulada

Abra a conversa e escreva na caixa de resposta (Enter envia, Shift+Enter quebra
linha). Cria uma `Message` `OUTBOUND`/`HUMAN` com o autor gravado em
`metadata` (`{ userId, userName }` — sem alteração de schema). Audit:
`MESSAGE_SENT`. Se a conversa estava `CLOSED`, a caixa fica desabilitada com
"Reabra a conversa para enviar uma nova mensagem."

## 10. Como assumir / encerrar / reabrir

Use os botões no cabeçalho da thread e o menu "mais ações". Cada ação muda o
status, grava uma mensagem de sistema na thread e registra o audit log
correspondente (seção 5).

## 11. Atribuição de mensagem humana (metadata, sem schema novo)

`Message` não tem `sentByUserId` nesta V1. Para atribuir a mensagem a um
atendente, gravamos `metadata = { userId, userName }`. Foi uma decisão
deliberada para **evitar migração de schema** agora; se no futuro precisarmos
consultar/relatar por autor, um campo `sentByUserId` pode ser adicionado.

## 12. O que ainda NÃO foi implementado

- WhatsApp Cloud API
- Webhook de recebimento de mensagens
- Envio real de WhatsApp (ou qualquer envio externo)
- Sinery Assist real (IA processando/respondendo)
- Classificação automática de intenção
- Respostas automáticas
- Notificações em tempo real (o painel atualiza via refresh após cada ação)
- Anexos (áudio, imagem, documentos)
- Templates de mensagem
- SLA de atendimento
- Fila avançada / distribuição automática
