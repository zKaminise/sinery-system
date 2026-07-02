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
        create: {
          assistantName: "Sinery Assist",
          enabled: true,
          tone: "professional",
          fallbackToHuman: true,
          humanFallbackMessage:
            "Vou te transferir para nossa recepção para continuar o atendimento.",
          canAnswerPricing: true,
          canSchedule: false,
          canReschedule: false,
          canCancel: false,
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

  console.log("Seed concluído:")
  console.log(`  Clínica: ${clinic.name} (${clinic.slug})`)
  console.log(`  Usuário owner: ${owner.email}`)
  console.log(`  Usuários: 3 (OWNER, RECEPTIONIST, PROFESSIONAL) — senha provisória Sinery@123`)
  console.log(`  Profissionais: 4, Pacientes: 5, Serviços: 6, Vínculos: 7, Agendamentos: ${appointments.length}`)
}

main()
  .catch((error) => {
    console.error("Erro ao rodar o seed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
