# Simulador da Sinery Assist — Sinery System

Módulo implementado no Prompt 12. Simula o comportamento futuro da Sinery
Assist usando **regras determinísticas**, sem IA real e sem WhatsApp real.

> **Atualização (Prompt 13):** a Sinery Assist agora tem também um modo de **IA
> real (OpenAI)** — ver [`docs/ai-assist.md`](./ai-assist.md). O simulador por
> regras descrito aqui continua sendo o **fallback** automático (sem chave, com
> `ASSIST_USE_REAL_AI=false`, em falha do provedor ou ao atingir o limite de
> tokens) e também dirige as **continuações** de fluxo (escolher "1", "sim")
> mesmo quando a IA real está ativa.

## 1. O que é o simulador

Um chat interno em `/assist` onde um usuário do sistema digita mensagens
**como se fosse o paciente**, e a "Sinery Assist" responde seguindo regras
fixas: detecta intenção por palavras-chave, consulta horários usando as regras
reais da agenda, sugere horários, cria/cancela/remarca/confirma consultas e
transfere para humano quando não entende. Tudo é registrado como
`Conversation` + `Message` reais e aparece também em `/conversas`.

## 2. Simulador vs IA real

| | Simulador (Prompt 12) | IA real (futuro) |
| --- | --- | --- |
| Classificação de intenção | palavras-chave/regras | modelo de linguagem |
| Compreensão | limitada a padrões fixos | linguagem natural |
| Memória | estado em `Conversation.metadata.assistFlow` | contexto do modelo |
| Integração externa | nenhuma (interno) | WhatsApp Cloud API |
| Determinístico | sim | não |

Nenhum LLM (OpenAI/Claude/Gemini) é chamado. O `assistant-engine.ts` é o ponto
onde uma IA real poderá substituir a classificação/geração mantendo a mesma
persistência e as mesmas regras de agenda.

## 3. Intenções suportadas (`lib/assist/intent-detector.ts`)

- **SCHEDULE_APPOINTMENT** — agendar ("marcar", "agendar", "tem horário").
- **RESCHEDULE_APPOINTMENT** — remarcar ("remarcar", "mudar meu horário").
- **CANCEL_APPOINTMENT** — cancelar ("cancelar", "não vou conseguir ir").
- **CONFIRM_APPOINTMENT** — confirmar ("confirmo", "vou sim").
- **ASK_ADDRESS** — endereço ("onde fica", "endereço").
- **ASK_HOURS** — funcionamento ("horário de funcionamento", "atendem sábado").
- **ASK_PRICE** — preço ("quanto custa", "valor").
- **HUMAN_HELP** — falar com atendente ("humano", "atendente").
- **EMERGENCY_OR_SENSITIVE** — dor/sangramento/remédio (segurança).
- **UNKNOWN** — não reconhecida.

A ordem de avaliação é importante: emergência e pedido de humano têm prioridade;
RESCHEDULE é checado antes de SCHEDULE (pois "remarcar" contém "marcar").

## 4. Fluxo de agendamento

1. Detecta serviço (nome aproximado) e data ("hoje/amanhã/depois de amanhã/dia
   da semana/dd/mm").
2. Se faltar serviço → pergunta o serviço. Se faltar data → pergunta a data.
3. Com serviço + data → `findAvailableSlots` gera até 3 horários.
4. Apresenta as opções numeradas e aguarda o número.
5. Ao escolher, **revalida** com `validateAndResolveAppointment` e cria o
   `Appointment` com `createdBySource = AI` e `createdByUserId = null`.
6. Confirma na conversa e registra `ASSIST_APPOINTMENT_CREATED` +
   `APPOINTMENT_CREATED`.

O estado entre mensagens fica em `Conversation.metadata.assistFlow`
(intent/step/serviço/data/slots) — substituto determinístico da "memória" que
uma IA teria. Se a conversa não tiver paciente vinculado, o agendamento é
recusado com orientação (agendar exige paciente).

## 5. Fluxo de cancelamento

Busca as próximas consultas ativas (SCHEDULED/CONFIRMED/RESCHEDULED) do
paciente. Se houver uma, pede confirmação (sim/não); se houver várias, lista
para escolha. Confirmado → status `CANCELLED` + `ASSIST_APPOINTMENT_CANCELLED`.
Sem paciente ou sem consultas → transfere para humano.

## 6. Fluxo de remarcação

Seleciona a consulta (uma ou várias), pergunta a nova data, sugere horários
para o mesmo serviço e, ao escolher, atualiza `startAt/endAt/professionalId` e
status `RESCHEDULED` (revalidando conflito com `excludeAppointmentId`).
Registra `ASSIST_APPOINTMENT_RESCHEDULED`. Casos incompletos transferem para
humano.

## 7. Fluxo de confirmação

Confirma a próxima consulta `SCHEDULED`/`RESCHEDULED` do paciente →
`CONFIRMED` + `ASSIST_APPOINTMENT_CONFIRMED`. Sem consulta pendente → transfere.

## 8. Transferência para humano

Ocorre em: HUMAN_HELP, EMERGENCY_OR_SENSITIVE, UNKNOWN, e nos fluxos quando
faltam dados. Efeitos: mensagem AI + mensagem SYSTEM, status da conversa vira
`WAITING_HUMAN`, e `ASSIST_TRANSFERRED_TO_HUMAN` é registrado. Em mensagens
sensíveis, a Assist **nunca** dá diagnóstico ou indica medicamento.

## 9. Regras de disponibilidade usadas

`findAvailableSlots` reutiliza as regras reais da agenda:

- serviço ativo da clínica;
- profissionais **ativos vinculados** ao serviço (`ProfessionalService`);
- `WorkingHour` ativos no dia da semana;
- granularidade = `ClinicSettings.appointmentSlotMinutes`;
- duração do slot = `service.durationMinutes`;
- exclui horários em conflito com consultas **bloqueantes**
  (SCHEDULED/CONFIRMED/RESCHEDULED — CANCELLED/COMPLETED/NO_SHOW não bloqueiam);
- ignora horários passados quando a data é hoje.

A criação final passa por `validateAndResolveAppointment`, a mesma validação
usada pela agenda manual — então a Assist nunca cria uma consulta fora das
regras.

## 10. Como AiSettings influencia o simulador

- **canAnswerPricing** — se `false`, perguntas de preço transferem para humano.
- **canSchedule / canReschedule / canCancel** — se `false`, a ação
  correspondente é recusada e transferida para humano.
- **enabled** — mesmo desativada, o simulador continua disponível para testes
  internos (a página avisa que a Assist está desativada para uso real).
- **humanFallbackMessage** — usada como mensagem de fallback no UNKNOWN.

Somente OWNER/ADMIN editam AiSettings (`AI_SETTINGS_UPDATED`).

## 11. Como AiKnowledgeBase é usada

A base de conhecimento é listada e gerenciada em `/assist` (criar/editar/
ativar/inativar — OWNER/ADMIN). Nesta V1 ela serve como contexto de apoio e
está pronta para ser consultada por respostas futuras; **não há busca
semântica nem embeddings**. Auditoria: `AI_KNOWLEDGE_CREATED/UPDATED/
STATUS_CHANGED`.

## 12. Como testar com pacientes do seed

1. `npm run db:push && npm run db:seed && npm run dev`.
2. Login OWNER (`admin@sorriaodonto.com.br` / `Sinery@123`), trocar senha.
3. `/assist` → "Nova simulação" → paciente **Mariana Alves** → "Quero marcar
   uma limpeza amanhã" → responda "1" → veja a consulta em `/agenda`.
4. Teste "qual endereço?", "quanto custa limpeza?", "quero falar com atendente",
   "estou com muita dor, qual remédio tomar?" (transfere sem medicar).
5. Com um paciente que tenha consulta futura: "quero cancelar minha consulta",
   "confirmo meu horário".

## 13. O que ainda NÃO foi implementado

- LLM real / IA generativa
- OpenAI/ChatGPT/Claude/Gemini API
- WhatsApp Cloud API / webhook real / envio externo
- Embeddings / busca semântica na base de conhecimento
- Memória avançada / compreensão de linguagem natural
- Classificação inteligente de intenção (é só por regras)
- Áudio/imagem/anexos
- Templates de WhatsApp
- Mensagens em tempo real (o painel atualiza via refresh)
- Pagamento, Google Calendar, recorrência, prontuário
