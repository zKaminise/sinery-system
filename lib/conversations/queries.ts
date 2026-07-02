import "server-only"

import { prisma } from "@/lib/prisma"
import {
  getClinicTimeZone,
  clinicToday,
  getWeekRangeUtc,
} from "@/lib/appointments/date-utils"
import type {
  ConversationStatus,
  ConversationChannel,
  MessageDirection,
  MessageSenderType,
  Prisma,
} from "@/lib/generated/prisma/client"

export const CONVERSATIONS_PAGE_SIZE = 20

export interface ConversationListItem {
  id: string
  displayName: string
  phone: string | null
  status: ConversationStatus
  channel: ConversationChannel
  patientId: string | null
  assignedUserId: string | null
  assignedUserName: string | null
  lastMessagePreview: string | null
  lastMessageAt: string | null
  updatedAt: string
}

export interface ConversationMessageItem {
  id: string
  direction: MessageDirection
  senderType: MessageSenderType
  content: string
  senderName: string | null
  createdAt: string
}

export interface ConversationDetail {
  id: string
  displayName: string
  phone: string | null
  status: ConversationStatus
  channel: ConversationChannel
  patientId: string | null
  patientName: string | null
  contactName: string | null
  contactPhone: string | null
  assignedUserId: string | null
  assignedUserName: string | null
  createdAt: string
  updatedAt: string
  messages: ConversationMessageItem[]
}

export interface ConversationSummary {
  open: number
  waitingHuman: number
  humanHandling: number
  aiHandling: number
  closedThisWeek: number
}

export interface ConversationFormOptions {
  patients: { id: string; name: string; phone: string }[]
  assignableUsers: { id: string; name: string }[]
}

export interface ConversationsListResult {
  items: ConversationListItem[]
  total: number
  page: number
  totalPages: number
}

/** A conversation's human-facing name: patient name, else manual contact name. */
function displayNameOf(conv: {
  contactName: string | null
  patient: { name: string } | null
}): string {
  return conv.patient?.name ?? conv.contactName ?? "Contato sem nome"
}

function phoneOf(conv: {
  contactPhone: string | null
  patient: { phone: string } | null
}): string | null {
  return conv.patient?.phone ?? conv.contactPhone ?? null
}

interface ListFilters {
  q?: string
  status?: ConversationStatus
  channel?: ConversationChannel
  assignedUserId?: string
  page: number
}

/**
 * Lists conversations for a clinic, filtered and paginated. Every query is
 * scoped by clinicId (from the caller's session, never the client). The last
 * message per conversation is fetched with a nested `take: 1` ordered desc.
 */
export async function getConversationsList(
  clinicId: string,
  filters: ListFilters
): Promise<ConversationsListResult> {
  const q = filters.q?.trim()
  const qDigits = q?.replace(/\D/g, "")

  const searchOr: Prisma.ConversationWhereInput[] | undefined = q
    ? [
        { contactName: { contains: q, mode: "insensitive" } },
        { patient: { name: { contains: q, mode: "insensitive" } } },
        { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
        ...(qDigits
          ? [
              { contactPhone: { contains: qDigits } },
              { patient: { phone: { contains: qDigits } } },
            ]
          : []),
      ]
    : undefined

  const where: Prisma.ConversationWhereInput = {
    clinicId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.assignedUserId
      ? filters.assignedUserId === "none"
        ? { assignedUserId: null }
        : { assignedUserId: filters.assignedUserId }
      : {}),
    ...(searchOr ? { OR: searchOr } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * CONVERSATIONS_PAGE_SIZE,
      take: CONVERSATIONS_PAGE_SIZE,
      select: {
        id: true,
        contactName: true,
        contactPhone: true,
        status: true,
        channel: true,
        patientId: true,
        assignedUserId: true,
        updatedAt: true,
        patient: { select: { name: true, phone: true } },
        assignedUser: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ])

  const items: ConversationListItem[] = rows.map((c) => {
    const last = c.messages[0]
    return {
      id: c.id,
      displayName: displayNameOf(c),
      phone: phoneOf(c),
      status: c.status,
      channel: c.channel,
      patientId: c.patientId,
      assignedUserId: c.assignedUserId,
      assignedUserName: c.assignedUser?.name ?? null,
      lastMessagePreview: last?.content ?? null,
      lastMessageAt: last?.createdAt.toISOString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
    }
  })

  return {
    items,
    total,
    page: filters.page,
    totalPages: Math.max(1, Math.ceil(total / CONVERSATIONS_PAGE_SIZE)),
  }
}

/**
 * Loads one conversation and its full message history, scoped by id + clinicId.
 * Returns null when it doesn't exist for this clinic — callers surface a 404
 * so cross-clinic existence is never revealed.
 */
export async function getConversationDetail(
  clinicId: string,
  conversationId: string
): Promise<ConversationDetail | null> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      status: true,
      channel: true,
      patientId: true,
      assignedUserId: true,
      createdAt: true,
      updatedAt: true,
      patient: { select: { name: true, phone: true } },
      assignedUser: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          direction: true,
          senderType: true,
          content: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  })

  if (!conv) return null

  return {
    id: conv.id,
    displayName: displayNameOf(conv),
    phone: phoneOf(conv),
    status: conv.status,
    channel: conv.channel,
    patientId: conv.patientId,
    patientName: conv.patient?.name ?? null,
    contactName: conv.contactName,
    contactPhone: conv.contactPhone,
    assignedUserId: conv.assignedUserId,
    assignedUserName: conv.assignedUser?.name ?? null,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messages: conv.messages.map((m) => {
      const meta = (m.metadata ?? null) as { userName?: string } | null
      return {
        id: m.id,
        direction: m.direction,
        senderType: m.senderType,
        content: m.content,
        senderName: meta?.userName ?? null,
        createdAt: m.createdAt.toISOString(),
      }
    }),
  }
}

/** Aggregate counts shown in the inbox summary cards. */
export async function getConversationSummary(clinicId: string): Promise<ConversationSummary> {
  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId },
    select: { timezone: true },
  })
  const timeZone = getClinicTimeZone(settings?.timezone)
  const weekRange = getWeekRangeUtc(clinicToday(timeZone), timeZone)

  const [grouped, closedThisWeek] = await Promise.all([
    prisma.conversation.groupBy({
      by: ["status"],
      where: { clinicId },
      _count: true,
    }),
    prisma.conversation.count({
      where: {
        clinicId,
        status: "CLOSED",
        updatedAt: { gte: weekRange.start, lt: weekRange.end },
      },
    }),
  ])

  const counts: Record<ConversationStatus, number> = {
    AI_HANDLING: 0,
    WAITING_HUMAN: 0,
    HUMAN_HANDLING: 0,
    CLOSED: 0,
  }
  for (const g of grouped) counts[g.status] = g._count

  return {
    open: counts.AI_HANDLING + counts.WAITING_HUMAN + counts.HUMAN_HANDLING,
    waitingHuman: counts.WAITING_HUMAN,
    humanHandling: counts.HUMAN_HANDLING,
    aiHandling: counts.AI_HANDLING,
    closedThisWeek,
  }
}

/** Patients (for linking) and active users (for assigning), scoped to clinic. */
export async function getConversationFormOptions(
  clinicId: string
): Promise<ConversationFormOptions> {
  const [patients, users] = await Promise.all([
    prisma.patient.findMany({
      where: { clinicId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.user.findMany({
      where: { clinicId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  return { patients, assignableUsers: users }
}
