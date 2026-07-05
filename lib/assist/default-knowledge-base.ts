/**
 * Base knowledge for a NEW clinic (Prompt 25). PURE — no DB. Every clinic is
 * born with a generic-but-useful Assist base; the clinic later edits these texts
 * and its Services/WorkingHours give the Assist structured data. Services are
 * NEVER hardcoded here — they come from the Services table at answer time.
 */
export interface DefaultKnowledgeBaseInput {
  clinicName: string
  city?: string | null
  state?: string | null
}

export interface KnowledgeBaseEntry {
  title: string
  content: string
}

/** Generic, editable initial knowledge-base entries for a new clinic. */
export function buildDefaultKnowledgeBase(input: DefaultKnowledgeBaseInput): KnowledgeBaseEntry[] {
  const name = input.clinicName?.trim() || "nossa clínica"
  const location = [input.city, input.state].map((s) => (s ?? "").trim()).filter(Boolean).join(" - ")

  return [
    {
      title: "Saudação",
      content: `Olá! Sou a assistente virtual da ${name}. Posso ajudar a marcar, remarcar ou cancelar consultas, listar os serviços e verificar horários disponíveis. Como posso ajudar?`,
    },
    {
      title: "Horário de atendimento",
      content:
        "Nosso horário de atendimento segue a agenda configurada da clínica. Posso verificar os horários disponíveis para o serviço que você deseja e sugerir opções.",
    },
    {
      title: "Endereço",
      content: location
        ? `Atendemos em ${location}. Se precisar do endereço completo ou de referências, um atendente pode confirmar.`
        : "Se precisar do endereço completo ou de referências para chegar, um atendente pode confirmar.",
    },
    {
      title: "Política de cancelamento e remarcação",
      content:
        "Cancelamentos e remarcações podem ser feitos com antecedência. Posso remarcar ou cancelar seu horário aqui mesmo — é só me pedir.",
    },
    {
      title: "Urgência e dor",
      content:
        "Em caso de dor intensa, urgência ou emergência, vou transferir você imediatamente para um atendente humano.",
    },
    {
      title: "Limites da assistente (sem diagnóstico)",
      content:
        "Sou uma assistente virtual: não faço diagnósticos nem indico medicamentos. Para avaliação clínica, agende uma consulta ou fale com um profissional.",
    },
    {
      title: "Pagamentos e convênios",
      content:
        "As formas de pagamento e os convênios aceitos podem variar. Um atendente pode confirmar os detalhes de pagamento e convênios com você.",
    },
  ]
}
