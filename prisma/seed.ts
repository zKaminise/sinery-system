import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

import { PrismaClient } from "../lib/generated/prisma/client"
import {
  clinicToday,
  getDayOfWeekForDate,
  zonedWallClockToUtc,
} from "../lib/appointments/date-utils"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const CLINIC_SLUG = "sorria-odonto"
const CLINIC_TIMEZONE = "America/Sao_Paulo"

/** Adds `days` to a "YYYY-MM-DD" string (UTC-based, safe for date-only math). */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

/** Nearest date (searching forward from `fromDate`) whose weekday is allowed. */
function nextMatchingDate(fromDate: string, allowedDays: number[]): string {
  let cursor = fromDate
  for (let i = 0; i < 14; i++) {
    if (allowedDays.includes(getDayOfWeekForDate(cursor, CLINIC_TIMEZONE))) return cursor
    cursor = addDays(cursor, 1)
  }
  return fromDate
}

// Development-only provisional password for the seeded owner user. The
// account is created with temporaryPassword: true, so the very first login
// forces a redirect to /alterar-senha before the real password is set.
// NEVER reuse this value outside local development/testing.
const OWNER_TEMPORARY_PASSWORD = "Sinery@123"

async function main() {
  // Safety guard: this seed creates DEMO data (a fake clinic + users with a
  // known provisional password). Never let it run against a production database
  // unless explicitly forced with SEED_ALLOW_PRODUCTION=true.
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    console.error(
      "Seed abortado: NODE_ENV=production. Este seed cria dados de demonstração e não deve rodar em produção. Para forçar (ex: staging), defina SEED_ALLOW_PRODUCTION=true."
    )
    process.exit(1)
  }

  // Re-seeding is idempotent: wipe any previous run of this demo tenant.
  // onDelete: Cascade on every child relation removes all related rows.
  await prisma.clinic.deleteMany({ where: { slug: CLINIC_SLUG } })

  const clinic = await prisma.clinic.create({
    data: {
      name: "Clínica Sorria Odonto",
      slug: CLINIC_SLUG,
      legalName: "Sorria Odontologia LTDA",
      segment: "ODONTOLOGY",
      status: "ACTIVE",
      email: "contato@sorriaodonto.com.br",
      phone: "(11) 4000-1234",
      whatsapp: "5511999990000",
      city: "São Paulo",
      state: "SP",
      settings: {
        create: {
          timezone: "America/Sao_Paulo",
          businessStartHour: 8,
          businessEndHour: 19,
          appointmentSlotMinutes: 30,
        },
      },
      aiSettings: {
        // Enabled with scheduling/rescheduling/cancelling on, so the Sinery
        // Assist simulator can demonstrate the full flow out of the box.
        create: {
          assistantName: "Sinery Assist",
          enabled: true,
          tone: "professional",
          fallbackToHuman: true,
          humanFallbackMessage:
            "Vou te transferir para nossa recepção para continuar o atendimento.",
          canAnswerPricing: true,
          canSchedule: true,
          canReschedule: true,
          canCancel: true,
        },
      },
    },
  })

  const ownerPasswordHash = await bcrypt.hash(OWNER_TEMPORARY_PASSWORD, 10)

  const owner = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      name: "Gabriel Admin",
      email: "admin@sorriaodonto.com.br",
      passwordHash: ownerPasswordHash,
      role: "OWNER",
      status: "ACTIVE",
      temporaryPassword: true,
    },
  })

  // Additional seeded users so the /configuracoes user list is realistic.
  // All share the dev-only provisional password (Sinery@123) and must change
  // it on first login. Idempotent: the clinic delete above cascades to users.
  await prisma.user.createMany({
    data: [
      {
        clinicId: clinic.id,
        name: "Mariana Recepção",
        email: "recepcao@sorriaodonto.com.br",
        passwordHash: ownerPasswordHash,
        role: "RECEPTIONIST",
        status: "ACTIVE",
        temporaryPassword: true,
      },
      {
        clinicId: clinic.id,
        name: "Dr. Felipe",
        email: "felipe@sorriaodonto.com.br",
        passwordHash: ownerPasswordHash,
        role: "PROFESSIONAL",
        status: "ACTIVE",
        temporaryPassword: true,
      },
    ],
  })

  const [drFelipe, drCamila, drRenato] = await Promise.all([
    prisma.professional.create({
      data: {
        clinicId: clinic.id,
        name: "Dr. Felipe Andrade",
        email: "felipe.andrade@sorriaodonto.com.br",
        phone: "11988881111",
        specialty: "Clínico geral",
        status: "ACTIVE",
      },
    }),
    prisma.professional.create({
      data: {
        clinicId: clinic.id,
        name: "Dra. Camila Rocha",
        email: "camila.rocha@sorriaodonto.com.br",
        phone: "11988882222",
        specialty: "Ortodontia",
        status: "ACTIVE",
      },
    }),
    prisma.professional.create({
      data: {
        clinicId: clinic.id,
        name: "Dr. Renato Lima",
        email: "renato.lima@sorriaodonto.com.br",
        phone: "11988883333",
        specialty: "Endodontia",
        status: "ACTIVE",
      },
    }),
    // Recently hired, deliberately left without working hours or linked
    // services — this is what powers the dashboard's "operational alerts"
    // demo (a professional who can't actually be booked yet).
    prisma.professional.create({
      data: {
        clinicId: clinic.id,
        name: "Dra. Beatriz Costa",
        email: "beatriz.costa@sorriaodonto.com.br",
        phone: "11988884444",
        specialty: "Periodontia",
        status: "ACTIVE",
      },
    }),
  ])

  await prisma.workingHour.createMany({
    data: [
      // Dr. Felipe: Monday-Friday, two blocks per day (morning + afternoon).
      ...[1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
        {
          clinicId: clinic.id,
          professionalId: drFelipe.id,
          dayOfWeek,
          startTime: "08:00",
          endTime: "12:00",
          active: true,
        },
        {
          clinicId: clinic.id,
          professionalId: drFelipe.id,
          dayOfWeek,
          startTime: "14:00",
          endTime: "18:00",
          active: true,
        },
      ]),
      // Dra. Camila: Monday/Wednesday/Friday, single afternoon-heavy block.
      ...[1, 3, 5].map((dayOfWeek) => ({
        clinicId: clinic.id,
        professionalId: drCamila.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "17:00",
        active: true,
      })),
      // Dr. Renato: Tuesday/Thursday mornings only.
      ...[2, 4].map((dayOfWeek) => ({
        clinicId: clinic.id,
        professionalId: drRenato.id,
        dayOfWeek,
        startTime: "08:00",
        endTime: "12:00",
        active: true,
      })),
    ],
  })

  const [patientMariana, patientJoao, patientCarla, patientAna, patientCarlos] =
    await Promise.all([
      prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: "Mariana Alves",
          phone: "5511977770001",
          email: "mariana.alves@example.com",
          document: "123.456.789-01",
          birthDate: new Date("1990-04-12"),
          source: "Instagram",
          notes: "Prefere agendamentos no período da manhã.",
          status: "ACTIVE",
        },
      }),
      prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: "João Pedro Souza",
          phone: "5511977770002",
          birthDate: new Date("1985-09-23"),
          source: "Indicação",
          status: "ACTIVE",
        },
      }),
      prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: "Carla Mendes",
          phone: "5511977770003",
          email: "carla.mendes@example.com",
          source: "Google",
          status: "ACTIVE",
        },
      }),
      prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: "Ana Carolina Ferreira",
          phone: "5511977770004",
          email: "ana.ferreira@example.com",
          document: "987.654.321-00",
          birthDate: new Date("1998-01-30"),
          source: "WhatsApp",
          notes: "Paciente com histórico de sensibilidade dentária.",
          status: "ACTIVE",
        },
      }),
      prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: "Carlos Eduardo Santos",
          phone: "5511977770005",
          source: "Site",
          status: "INACTIVE",
        },
      }),
    ])

  const [servicoAvaliacao, servicoLimpeza, servicoClareamento, servicoManutencao, servicoCanal] =
    await Promise.all([
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Avaliação inicial",
          description: "Consulta inicial para avaliar o paciente e indicar o tratamento",
          durationMinutes: 30,
          priceInCents: null,
          status: "ACTIVE",
        },
      }),
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Limpeza",
          description: "Profilaxia e remoção de tártaro",
          durationMinutes: 60,
          priceInCents: 18000,
          status: "ACTIVE",
        },
      }),
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Clareamento",
          durationMinutes: 90,
          priceInCents: 60000,
          status: "ACTIVE",
        },
      }),
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Manutenção ortodôntica",
          description: "Ajuste periódico do aparelho ortodôntico",
          durationMinutes: 30,
          priceInCents: 15000,
          status: "ACTIVE",
        },
      }),
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Tratamento de canal",
          durationMinutes: 120,
          priceInCents: 90000,
          status: "ACTIVE",
        },
      }),
    ])

  // Active but with no professional linked yet — powers the dashboard's
  // "serviço sem profissional vinculado" alert demo.
  await prisma.service.create({
    data: {
      clinicId: clinic.id,
      name: "Extração de siso",
      description: "Remoção cirúrgica de terceiro molar",
      durationMinutes: 90,
      priceInCents: 45000,
      status: "ACTIVE",
    },
  })

  // Appointments are placed on real working days for each professional so
  // they always pass the same validation the app enforces (working hours, no
  // conflicts) — regardless of which weekday the seed is run. Times are
  // clinic-local wall clock converted to UTC instants via zonedWallClockToUtc,
  // exactly like the create API does.
  const today = clinicToday(CLINIC_TIMEZONE)
  const felipeDay = nextMatchingDate(today, [1, 2, 3, 4, 5]) // Mon–Fri
  const camilaDay = nextMatchingDate(today, [1, 3, 5]) // Mon/Wed/Fri
  const renatoDay = nextMatchingDate(today, [2, 4]) // Tue/Thu
  const renatoPastDay = addDays(renatoDay, -7) // same weekday, previous week

  function slot(date: string, startTime: string, endTime: string) {
    return {
      startAt: zonedWallClockToUtc(date, startTime, CLINIC_TIMEZONE),
      endAt: zonedWallClockToUtc(date, endTime, CLINIC_TIMEZONE),
    }
  }

  const appointmentsData = [
    // Dr. Felipe — two non-overlapping slots on the same day.
    {
      patientId: patientMariana.id,
      professionalId: drFelipe.id,
      serviceId: servicoAvaliacao.id,
      ...slot(felipeDay, "09:00", "09:30"),
      status: "SCHEDULED" as const,
    },
    {
      patientId: patientJoao.id,
      professionalId: drFelipe.id,
      serviceId: servicoLimpeza.id,
      ...slot(felipeDay, "10:00", "11:00"),
      status: "CONFIRMED" as const,
    },
    // Dra. Camila — two non-overlapping slots on the same day.
    {
      patientId: patientAna.id,
      professionalId: drCamila.id,
      serviceId: servicoManutencao.id,
      ...slot(camilaDay, "14:00", "14:30"),
      status: "RESCHEDULED" as const,
    },
    {
      patientId: patientCarlos.id,
      professionalId: drCamila.id,
      serviceId: servicoClareamento.id,
      ...slot(camilaDay, "15:00", "16:30"),
      status: "SCHEDULED" as const,
    },
    // Dr. Renato — a completed appointment on a past working day.
    {
      patientId: patientCarla.id,
      professionalId: drRenato.id,
      serviceId: servicoCanal.id,
      ...slot(renatoPastDay, "08:00", "10:00"),
      status: "COMPLETED" as const,
    },
    // A cancelled and a no-show slot this week, so the dashboard's weekly
    // summary and "cancellations/no-shows" cards have real, non-zero data.
    {
      patientId: patientJoao.id,
      professionalId: drFelipe.id,
      serviceId: servicoAvaliacao.id,
      ...slot(felipeDay, "11:30", "12:00"),
      status: "CANCELLED" as const,
    },
    {
      patientId: patientMariana.id,
      professionalId: drCamila.id,
      serviceId: servicoManutencao.id,
      ...slot(camilaDay, "16:30", "17:00"),
      status: "NO_SHOW" as const,
    },
  ]

  const appointments = await Promise.all(
    appointmentsData.map((appointment) =>
      prisma.appointment.create({
        data: {
          clinicId: clinic.id,
          patientId: appointment.patientId,
          professionalId: appointment.professionalId,
          serviceId: appointment.serviceId,
          startAt: appointment.startAt,
          endAt: appointment.endAt,
          status: appointment.status,
          createdByUserId: owner.id,
          createdBySource: "USER",
        },
      })
    )
  )

  // Professional <-> Service links: which professional performs which
  // service, used by the future Agenda module. Matches the pairing described
  // in the working hours above (Felipe = general/cleaning, Camila =
  // orthodontics/whitening, Renato = endodontics), plus everyone can do the
  // initial evaluation.
  await Promise.all([
    prisma.professionalService.create({
      data: { clinicId: clinic.id, professionalId: drFelipe.id, serviceId: servicoAvaliacao.id },
    }),
    prisma.professionalService.create({
      data: { clinicId: clinic.id, professionalId: drCamila.id, serviceId: servicoAvaliacao.id },
    }),
    prisma.professionalService.create({
      data: { clinicId: clinic.id, professionalId: drCamila.id, serviceId: servicoManutencao.id },
    }),
    prisma.professionalService.create({
      data: { clinicId: clinic.id, professionalId: drRenato.id, serviceId: servicoAvaliacao.id },
    }),
  ])

  const [linkFelipeLimpeza, linkCamilaClareamento, linkRenatoCanal] = await Promise.all([
    prisma.professionalService.create({
      data: { clinicId: clinic.id, professionalId: drFelipe.id, serviceId: servicoLimpeza.id },
    }),
    prisma.professionalService.create({
      data: { clinicId: clinic.id, professionalId: drCamila.id, serviceId: servicoClareamento.id },
    }),
    prisma.professionalService.create({
      data: { clinicId: clinic.id, professionalId: drRenato.id, serviceId: servicoCanal.id },
    }),
  ])

  // Sample audit logs across several event types so the /auditoria screen has
  // realistic, varied content out of the box. This stays idempotent because
  // deleting the clinic above cascade-deletes its previous audit logs, so
  // re-running the seed never accumulates duplicates.
  await prisma.auditLog.createMany({
    data: [
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "CLINIC_CREATED",
        entity: "Clinic",
        entityId: clinic.id,
        description: "Clínica criada via seed inicial do Sinery System",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "USER_CREATED",
        entity: "User",
        entityId: owner.id,
        description: "Usuário owner mockado criado via seed",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PATIENT_CREATED",
        entity: "Patient",
        entityId: patientMariana.id,
        description: "Paciente Mariana Alves cadastrada via seed",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PATIENT_CREATED",
        entity: "Patient",
        entityId: patientAna.id,
        description: "Paciente Ana Carolina Ferreira foi cadastrado.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PATIENT_STATUS_CHANGED",
        entity: "Patient",
        entityId: patientCarlos.id,
        description: "Status do paciente Carlos Eduardo Santos foi alterado para inativo.",
        metadata: { from: "ACTIVE", to: "INACTIVE" },
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "APPOINTMENT_CREATED",
        entity: "Appointment",
        entityId: appointments[0].id,
        description: "Agendamento de exemplo criado via seed",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PROFESSIONAL_CREATED",
        entity: "Professional",
        entityId: drFelipe.id,
        description: "Profissional Dr. Felipe Andrade foi cadastrado.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PROFESSIONAL_CREATED",
        entity: "Professional",
        entityId: drCamila.id,
        description: "Profissional Dra. Camila Rocha foi cadastrado.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "SERVICE_CREATED",
        entity: "Service",
        entityId: servicoLimpeza.id,
        description: "Serviço Limpeza foi cadastrado.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "SERVICE_CREATED",
        entity: "Service",
        entityId: servicoCanal.id,
        description: "Serviço Tratamento de canal foi cadastrado.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PROFESSIONAL_SERVICE_LINKED",
        entity: "ProfessionalService",
        entityId: linkFelipeLimpeza.id,
        description: "Serviço Limpeza foi vinculado ao profissional Dr. Felipe Andrade.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PROFESSIONAL_SERVICE_LINKED",
        entity: "ProfessionalService",
        entityId: linkCamilaClareamento.id,
        description: "Serviço Clareamento foi vinculado ao profissional Dra. Camila Rocha.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "PROFESSIONAL_SERVICE_LINKED",
        entity: "ProfessionalService",
        entityId: linkRenatoCanal.id,
        description: "Serviço Tratamento de canal foi vinculado ao profissional Dr. Renato Lima.",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "AUTH_LOGIN_SUCCESS",
        entity: "User",
        entityId: owner.id,
        description: "Usuário Gabriel Admin realizou login (exemplo de seed).",
      },
      {
        clinicId: clinic.id,
        userId: owner.id,
        action: "AUTH_PASSWORD_CHANGED",
        entity: "User",
        entityId: owner.id,
        description: "Usuário Gabriel Admin alterou a senha (exemplo de seed).",
      },
      {
        clinicId: clinic.id,
        userId: null,
        action: "SYSTEM_HEALTH_CHECK",
        entity: "System",
        description: "Verificação de saúde executada (exemplo de seed).",
      },
    ],
  })

  // Test conversations (channel INTERNAL_SIMULATOR) so the /conversas inbox has
  // realistic content. Idempotent: the clinic delete above cascades to
  // conversations + messages, so re-seeding never duplicates them. Message
  // createdAt values are set explicitly to keep the thread order stable.
  const receptionist = await prisma.user.findFirst({
    where: { clinicId: clinic.id, role: "RECEPTIONIST" },
    select: { id: true, name: true },
  })
  const baseTime = Date.now()
  const at = (minutesAgo: number) => new Date(baseTime - minutesAgo * 60_000)

  async function seedConversation(input: {
    patient: { id: string; name: string; phone: string }
    status: "AI_HANDLING" | "WAITING_HUMAN" | "HUMAN_HANDLING" | "CLOSED"
    assignedUserId?: string | null
    messages: {
      direction: "INBOUND" | "OUTBOUND"
      senderType: "PATIENT" | "AI" | "HUMAN" | "SYSTEM"
      content: string
      minutesAgo: number
      metadata?: { userId: string; userName: string }
    }[]
  }) {
    const conversation = await prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        patientId: input.patient.id,
        channel: "INTERNAL_SIMULATOR",
        status: input.status,
        contactName: input.patient.name,
        contactPhone: input.patient.phone,
        assignedUserId: input.assignedUserId ?? null,
      },
    })
    await prisma.message.createMany({
      data: input.messages.map((m) => ({
        clinicId: clinic.id,
        conversationId: conversation.id,
        direction: m.direction,
        senderType: m.senderType,
        content: m.content,
        metadata: m.metadata,
        createdAt: at(m.minutesAgo),
      })),
    })
    return conversation
  }

  await seedConversation({
    patient: patientMariana,
    status: "WAITING_HUMAN",
    messages: [
      { direction: "OUTBOUND", senderType: "SYSTEM", content: "Conversa criada em modo de teste interno.", minutesAgo: 61 },
      { direction: "INBOUND", senderType: "PATIENT", content: "Olá, gostaria de marcar uma limpeza.", minutesAgo: 60 },
    ],
  })

  await seedConversation({
    patient: patientJoao,
    status: "HUMAN_HANDLING",
    assignedUserId: receptionist?.id ?? null,
    messages: [
      { direction: "INBOUND", senderType: "PATIENT", content: "Quero confirmar meu horário de hoje.", minutesAgo: 45 },
      {
        direction: "OUTBOUND",
        senderType: "HUMAN",
        content: "Olá, João! Seu horário está confirmado.",
        minutesAgo: 43,
        metadata: receptionist ? { userId: receptionist.id, userName: receptionist.name } : undefined,
      },
    ],
  })

  await seedConversation({
    patient: patientAna,
    status: "AI_HANDLING",
    messages: [
      { direction: "INBOUND", senderType: "PATIENT", content: "Vocês têm horário amanhã à tarde?", minutesAgo: 30 },
      {
        direction: "OUTBOUND",
        senderType: "AI",
        content: "A Sinery Assist será implementada nas próximas etapas. Esta é uma mensagem de demonstração.",
        minutesAgo: 29,
      },
    ],
  })

  await seedConversation({
    patient: patientCarla,
    status: "CLOSED",
    messages: [
      { direction: "INBOUND", senderType: "PATIENT", content: "Obrigado!", minutesAgo: 120 },
      {
        direction: "OUTBOUND",
        senderType: "HUMAN",
        content: "Nós que agradecemos. Até breve!",
        minutesAgo: 119,
        metadata: receptionist ? { userId: receptionist.id, userName: receptionist.name } : undefined,
      },
      { direction: "OUTBOUND", senderType: "SYSTEM", content: "Conversa encerrada.", minutesAgo: 118 },
    ],
  })

  // Knowledge base for the Sinery Assist simulator. Idempotent via the clinic
  // delete-cascade at the top of the seed.
  await prisma.aiKnowledgeBase.createMany({
    data: [
      {
        clinicId: clinic.id,
        title: "Endereço da clínica",
        content: "Atendemos em São Paulo - SP. Para o endereço completo e referências, fale com a recepção.",
        active: true,
      },
      {
        clinicId: clinic.id,
        title: "Formas de pagamento",
        content: "Aceitamos dinheiro, PIX e cartões de crédito/débito. Parcelamento sujeito à avaliação.",
        active: true,
      },
      {
        clinicId: clinic.id,
        title: "Política de cancelamento",
        content: "Cancelamentos e remarcações devem ser feitos com pelo menos 24 horas de antecedência.",
        active: true,
      },
      {
        clinicId: clinic.id,
        title: "Sobre a avaliação inicial",
        content: "A avaliação inicial dura cerca de 30 minutos e serve para indicar o melhor tratamento.",
        active: true,
      },
      {
        clinicId: clinic.id,
        title: "Sobre a limpeza",
        content: "A limpeza (profilaxia) remove tártaro e placa, com duração aproximada de 60 minutos.",
        active: true,
      },
    ],
  })

  // Two Sinery Assist demo simulations (INTERNAL_SIMULATOR + AI messages).
  await seedConversation({
    patient: patientMariana,
    status: "AI_HANDLING",
    messages: [
      { direction: "INBOUND", senderType: "PATIENT", content: "Quero marcar uma limpeza amanhã", minutesAgo: 20 },
      {
        direction: "OUTBOUND",
        senderType: "AI",
        content:
          "Encontrei estes horários para Limpeza amanhã:\n1. 09:00 com Dr. Felipe Andrade\n\nResponda com o número da opção desejada.",
        minutesAgo: 19,
      },
    ],
  })

  await seedConversation({
    patient: patientCarla,
    status: "WAITING_HUMAN",
    messages: [
      { direction: "INBOUND", senderType: "PATIENT", content: "estou com muita dor, qual remédio tomar?", minutesAgo: 10 },
      {
        direction: "OUTBOUND",
        senderType: "AI",
        content:
          "Sinto muito por isso. Para sua segurança, vou chamar alguém da equipe para te orientar corretamente. Se for uma emergência, procure atendimento imediatamente.",
        minutesAgo: 9,
      },
      {
        direction: "OUTBOUND",
        senderType: "SYSTEM",
        content: "Mensagem sensível detectada. Conversa transferida para atendimento humano.",
        minutesAgo: 9,
      },
    ],
  })

  // WhatsApp integration (Prompt 16 — preparatory, NEVER stores a token).
  await prisma.whatsAppIntegration.upsert({
    where: { clinicId: clinic.id },
    update: {
      provider: "META_CLOUD_API",
      displayPhoneNumber: "+55 34 99999-0000",
      verifiedName: "Clínica Sorria Odonto",
    },
    create: {
      clinicId: clinic.id,
      enabled: false,
      provider: "META_CLOUD_API",
      displayPhoneNumber: "+55 34 99999-0000",
      verifiedName: "Clínica Sorria Odonto",
      status: "NOT_CONFIGURED",
      sendMessagesEnabled: false,
      webhookEnabled: false,
      webhookVerifyTokenConfigured: false,
      webhookPath: "/api/webhooks/whatsapp",
    },
  })

  // --- Platform / billing (Prompt 21) ---------------------------------------
  // PlatformUser is NOT clinic-scoped, so it survives the clinic delete/recreate;
  // upsert keeps it idempotent (and preserves a changed password on re-seed).
  const founderPasswordHash = await bcrypt.hash("Sinery@123", 10)
  await prisma.platformUser.upsert({
    where: { email: "founder@sinery.local" },
    // Reset to the demo provisional password on every seed (dev convenience).
    update: { passwordHash: founderPasswordHash, temporaryPassword: true, status: "ACTIVE" },
    create: {
      name: "Gabriel Founder",
      email: "founder@sinery.local",
      passwordHash: founderPasswordHash,
      role: "FOUNDER",
      status: "ACTIVE",
      temporaryPassword: true,
    },
  })

  // Commercial plans (idempotent by slug).
  const planSeed = [
    { name: "Free / Internal", slug: "free-internal", priceInCents: 0, billingInterval: "FREE" as const, includesAi: false, includesWhatsapp: false, description: "Uso interno / cortesia." },
    { name: "Founder Pilot", slug: "founder-pilot", priceInCents: 19700, billingInterval: "MONTHLY" as const, includesAi: true, includesWhatsapp: true, description: "Plano piloto do founder." },
    { name: "Pro Clinic", slug: "pro-clinic", priceInCents: 39700, billingInterval: "MONTHLY" as const, includesAi: true, includesWhatsapp: true, description: "Clínica em operação." },
    { name: "Premium Clinic", slug: "premium-clinic", priceInCents: 69700, billingInterval: "MONTHLY" as const, includesAi: true, includesWhatsapp: true, description: "Clínica com uso intenso." },
    { name: "Annual Pro", slug: "annual-pro", priceInCents: 397000, billingInterval: "YEARLY" as const, includesAi: true, includesWhatsapp: true, description: "Pro no plano anual." },
  ]
  for (const p of planSeed) {
    await prisma.plan.upsert({ where: { slug: p.slug }, update: p, create: p })
  }
  const founderPilot = await prisma.plan.findUnique({ where: { slug: "founder-pilot" } })

  // Subscription + invoices for the demo clinic (cascade-deleted with the clinic).
  const seedNow = new Date()
  const nextDue = new Date(seedNow.getTime() + 15 * 86_400_000)
  const lastMonth = new Date(seedNow.getTime() - 20 * 86_400_000)
  const subscription = await prisma.clinicSubscription.create({
    data: {
      clinicId: clinic.id,
      planId: founderPilot?.id,
      status: "ACTIVE",
      billingType: "MANUAL",
      paymentMethod: "MANUAL",
      amountInCents: 19700,
      currentPeriodStart: seedNow,
      nextDueDate: nextDue,
      graceDays: 20,
      internalNotes: "Clínica de demonstração (seed).",
    },
  })
  await prisma.billingInvoice.create({
    data: { clinicId: clinic.id, subscriptionId: subscription.id, status: "PAID", paymentMethod: "PIX", amountInCents: 19700, dueDate: lastMonth, paidAt: lastMonth, manualPaymentReference: "Pix seed" },
  })
  await prisma.billingInvoice.create({
    data: { clinicId: clinic.id, subscriptionId: subscription.id, status: "PENDING", paymentMethod: "MANUAL", amountInCents: 19700, dueDate: nextDue },
  })
  await prisma.billingEvent.createMany({
    data: [
      { clinicId: clinic.id, subscriptionId: subscription.id, type: "CLINIC_CREATED", message: "Clínica de demonstração criada pelo seed." },
      { clinicId: clinic.id, subscriptionId: subscription.id, type: "INVOICE_PAID", message: "Pagamento inicial registrado (seed)." },
    ],
  })

  // --- Email logs + checkout sessions (Prompt 22, idempotent) ---------------
  await prisma.emailLog.deleteMany({ where: { toEmail: { in: ["admin@sorriaodonto.com.br", "novocliente@exemplo.com.br"] } } })
  await prisma.emailLog.createMany({
    data: [
      { clinicId: clinic.id, toEmail: "admin@sorriaodonto.com.br", fromEmail: "Sinery <no-reply@sinery.com.br>", replyToEmail: "kaminise@sinery.com.br", subject: "Seu acesso ao Sinery System foi criado", type: "OWNER_WELCOME_FOUNDER", status: "MOCKED", provider: "MOCK", sentAt: new Date() },
      { toEmail: "novocliente@exemplo.com.br", fromEmail: "Sinery <no-reply@sinery.com.br>", replyToEmail: "kaminise@sinery.com.br", subject: "Seu código de recuperação — Sinery", type: "PASSWORD_RESET_CODE", status: "MOCKED", provider: "MOCK", sentAt: new Date() },
    ],
  })

  await prisma.checkoutSession.deleteMany({ where: { publicId: { in: ["seedawaiting01", "seedprovisioned1"] } } })
  await prisma.checkoutSession.create({
    data: {
      publicId: "seedawaiting01",
      planId: founderPilot?.id,
      status: "AWAITING_PAYMENT",
      clinicName: "Clínica Demo Checkout",
      desiredSlug: "clinica-demo-checkout",
      ownerName: "Responsável Demo",
      ownerEmail: "demo-checkout@exemplo.com.br",
      amountInCents: 19700,
      billingInterval: "MONTHLY",
      externalProvider: "ASAAS",
      externalSubscriptionId: "mock_sub_seed01",
      externalPaymentUrl: "http://localhost:3000/checkout-mock/seed01",
      expiresAt: new Date(seedNow.getTime() + 7 * 86_400_000),
    },
  })
  await prisma.checkoutSession.create({
    data: {
      publicId: "seedprovisioned1",
      planId: founderPilot?.id,
      clinicId: clinic.id,
      status: "PROVISIONED",
      clinicName: clinic.name,
      desiredSlug: clinic.slug,
      ownerName: "Gabriel Admin",
      ownerEmail: "admin@sorriaodonto.com.br",
      amountInCents: 19700,
      billingInterval: "MONTHLY",
      externalProvider: "ASAAS",
      externalSubscriptionId: "mock_sub_seed02",
      paidAt: seedNow,
    },
  })

  console.log("Seed concluído:")
  console.log(`  Clínica: ${clinic.name} (${clinic.slug})`)
  console.log(`  Usuário owner: ${owner.email}`)
  console.log(`  Usuários: 3 (OWNER, RECEPTIONIST, PROFESSIONAL) — senha provisória Sinery@123`)
  console.log(`  Profissionais: 4, Pacientes: 5, Serviços: 6, Vínculos: 7, Agendamentos: ${appointments.length}`)
  console.log(`  Conversas de teste: 4 + 2 simulações da Assist · Base de conhecimento: 5 itens · WhatsApp: NOT_CONFIGURED`)
  console.log(`  Founder: founder@sinery.local — senha provisória Sinery@123 (painel /founder)`)
  console.log(`  Planos: 5 · Assinatura: Founder Pilot (ACTIVE) · Faturas: 1 paga + 1 pendente`)
}

main()
  .catch((error) => {
    console.error("Erro ao rodar o seed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
