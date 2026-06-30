export interface DashboardStat {
  label: string
  value: string
  hint: string
}

export const dashboardStats: DashboardStat[] = [
  { label: "Consultas hoje", value: "12", hint: "+2 em relação a ontem" },
  { label: "Aguardando confirmação", value: "4", hint: "Confirmar até amanhã" },
  { label: "Conversas pendentes", value: "3", hint: "Resposta humana necessária" },
  { label: "Agendamentos pela IA", value: "7", hint: "Via Sinery Assist hoje" },
]

export type AgendaStatus = "Confirmado" | "Aguardando" | "Em atendimento" | "Concluído"

export interface AgendaItem {
  time: string
  patient: string
  service: string
  professional: string
  status: AgendaStatus
}

export const todayAgenda: AgendaItem[] = [
  {
    time: "08:30",
    patient: "Mariana Alves",
    service: "Limpeza dental",
    professional: "Dra. Beatriz Lima",
    status: "Confirmado",
  },
  {
    time: "09:15",
    patient: "João Pedro Souza",
    service: "Avaliação ortodôntica",
    professional: "Dr. Rafael Tanaka",
    status: "Em atendimento",
  },
  {
    time: "10:00",
    patient: "Carla Mendes",
    service: "Clareamento dental",
    professional: "Dra. Beatriz Lima",
    status: "Aguardando",
  },
  {
    time: "11:30",
    patient: "Eduardo Santos",
    service: "Extração de siso",
    professional: "Dr. Henrique Costa",
    status: "Concluído",
  },
]

export type ConversationStatus = "IA atendendo" | "Aguardando humano" | "Finalizado"

export interface ConversationItem {
  patient: string
  lastMessage: string
  status: ConversationStatus
}

export const recentConversations: ConversationItem[] = [
  {
    patient: "Fernanda Ribeiro",
    lastMessage: "Posso remarcar minha consulta para sexta-feira?",
    status: "Aguardando humano",
  },
  {
    patient: "Lucas Martins",
    lastMessage: "Qual o valor do clareamento dental?",
    status: "IA atendendo",
  },
  {
    patient: "Patrícia Gomes",
    lastMessage: "Obrigada, confirmado o horário das 14h!",
    status: "Finalizado",
  },
  {
    patient: "Diego Fernandes",
    lastMessage: "Vocês atendem por convênio Amil?",
    status: "IA atendendo",
  },
]
