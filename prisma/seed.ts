import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

import { PrismaClient } from "../lib/generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const CLINIC_SLUG = "sorria-odonto"

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

  const [drBeatriz, drRafael] = await Promise.all([
    prisma.professional.create({
      data: {
        clinicId: clinic.id,
        name: "Dra. Beatriz Lima",
        email: "beatriz.lima@sorriaodonto.com.br",
        phone: "(11) 98888-1111",
        specialty: "Clínica geral e estética",
        status: "ACTIVE",
      },
    }),
    prisma.professional.create({
      data: {
        clinicId: clinic.id,
        name: "Dr. Rafael Tanaka",
        email: "rafael.tanaka@sorriaodonto.com.br",
        phone: "(11) 98888-2222",
        specialty: "Ortodontia",
        status: "ACTIVE",
      },
    }),
  ])

  await prisma.workingHour.createMany({
    data: [1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
      {
        clinicId: clinic.id,
        professionalId: drBeatriz.id,
        dayOfWeek,
        startTime: "08:00",
        endTime: "17:00",
        active: true,
      },
      {
        clinicId: clinic.id,
        professionalId: drRafael.id,
        dayOfWeek,
        startTime: "10:00",
        endTime: "19:00",
        active: true,
      },
    ]),
  })

  const [patientMariana, patientJoao, patientCarla] = await Promise.all([
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        name: "Mariana Alves",
        phone: "5511977770001",
        email: "mariana.alves@example.com",
        source: "Instagram",
        status: "ACTIVE",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        name: "João Pedro Souza",
        phone: "5511977770002",
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
  ])

  const [servicoLimpeza, servicoAvaliacao, servicoClareamento, servicoExtracao] =
    await Promise.all([
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Limpeza dental",
          description: "Profilaxia e remoção de tártaro",
          durationMinutes: 40,
          priceInCents: 15000,
          status: "ACTIVE",
        },
      }),
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Avaliação ortodôntica",
          description: "Consulta inicial para avaliação de aparelho",
          durationMinutes: 30,
          priceInCents: 0,
          status: "ACTIVE",
        },
      }),
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Clareamento dental",
          durationMinutes: 60,
          priceInCents: 45000,
          status: "ACTIVE",
        },
      }),
      prisma.service.create({
        data: {
          clinicId: clinic.id,
          name: "Extração de siso",
          durationMinutes: 50,
          priceInCents: 35000,
          status: "ACTIVE",
        },
      }),
    ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function at(hour: number, minute: number) {
    const date = new Date(today)
    date.setHours(hour, minute, 0, 0)
    return date
  }

  function plusMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000)
  }

  const appointmentsData = [
    {
      patientId: patientMariana.id,
      professionalId: drBeatriz.id,
      serviceId: servicoLimpeza.id,
      startAt: at(8, 30),
      durationMinutes: 40,
      status: "CONFIRMED" as const,
    },
    {
      patientId: patientJoao.id,
      professionalId: drRafael.id,
      serviceId: servicoAvaliacao.id,
      startAt: at(10, 0),
      durationMinutes: 30,
      status: "SCHEDULED" as const,
    },
    {
      patientId: patientCarla.id,
      professionalId: drBeatriz.id,
      serviceId: servicoClareamento.id,
      startAt: at(11, 0),
      durationMinutes: 60,
      status: "SCHEDULED" as const,
    },
    {
      patientId: patientMariana.id,
      professionalId: drRafael.id,
      serviceId: servicoExtracao.id,
      startAt: at(14, 0),
      durationMinutes: 50,
      status: "COMPLETED" as const,
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
          endAt: plusMinutes(appointment.startAt, appointment.durationMinutes),
          status: appointment.status,
          createdByUserId: owner.id,
          createdBySource: "USER",
        },
      })
    )
  )

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
        action: "APPOINTMENT_CREATED",
        entity: "Appointment",
        entityId: appointments[0].id,
        description: "Agendamento de exemplo criado via seed",
      },
    ],
  })

  console.log("Seed concluído:")
  console.log(`  Clínica: ${clinic.name} (${clinic.slug})`)
  console.log(`  Usuário owner: ${owner.email}`)
  console.log(`  Profissionais: 2, Pacientes: 3, Serviços: 4, Agendamentos: ${appointments.length}`)
}

main()
  .catch((error) => {
    console.error("Erro ao rodar o seed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
