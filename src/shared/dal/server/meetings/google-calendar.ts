import type { MeetingForGCal } from '@/shared/services/google-calendar/lib/map-to-gcal'

import { eq, isNotNull } from 'drizzle-orm'
import { getParticipantEmails } from '@/shared/dal/server/meetings/participants'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getMeetingForGCal(meetingId: string): Promise<MeetingForGCal | null> {
  const [row] = await db
    .select({
      id: meetings.id,
      scheduledFor: meetings.scheduledFor,
      meetingType: meetings.meetingType,
      projectId: meetings.projectId,
      agentNotes: meetings.agentNotes,
      flowStateJSON: meetings.flowStateJSON,
      gcalEventId: meetings.gcalEventId,
      gcalEtag: meetings.gcalEtag,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      customerAddress: customers.address,
      customerCity: customers.city,
      customerState: customers.state,
      customerZip: customers.zip,
    })
    .from(meetings)
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .where(eq(meetings.id, meetingId))

  if (!row) {
    return null
  }

  const flowState = row.flowStateJSON as { tradeSelections?: { tradeName: string, selectedScopes: { label: string }[] }[] } | null
  const tradeSelections = flowState?.tradeSelections ?? []
  const participantEmails = await getParticipantEmails(meetingId)

  return {
    id: row.id,
    scheduledFor: row.scheduledFor,
    meetingType: row.meetingType,
    projectId: row.projectId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    customerAddress: row.customerAddress,
    customerCity: row.customerCity,
    customerState: row.customerState,
    customerZip: row.customerZip,
    agentNotes: row.agentNotes,
    tradeSelections,
    gcalEventId: row.gcalEventId,
    gcalEtag: row.gcalEtag,
    participantEmails,
  }
}

export async function getAllMeetingsWithSchedule(): Promise<{ id: string }[]> {
  return db
    .select({ id: meetings.id })
    .from(meetings)
    .where(isNotNull(meetings.scheduledFor))
}

export async function getMeetingByGCalEventId(gcalEventId: string) {
  return db.query.meetings.findFirst({
    where: eq(meetings.gcalEventId, gcalEventId),
    columns: {
      id: true,
      gcalEventId: true,
      gcalEtag: true,
      gcalSyncedAt: true,
      updatedAt: true,
    },
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function updateMeetingGCalFields(
  meetingId: string,
  fields: { gcalEventId?: string | null, gcalEtag?: string | null, gcalSyncedAt?: string | null },
): Promise<void> {
  await db.update(meetings)
    .set(fields)
    .where(eq(meetings.id, meetingId))
}

export async function clearMeetingGCalFields(meetingId: string): Promise<void> {
  await db.update(meetings)
    .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
    .where(eq(meetings.id, meetingId))
}

export async function clearAllMeetingGCalFieldsForUser(userId: string): Promise<void> {
  await db.update(meetings)
    .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
    .where(eq(meetings.ownerId, userId))
}

export async function updateMeetingScheduledFor(
  meetingId: string,
  scheduledFor: string | null,
): Promise<void> {
  await db.update(meetings)
    .set({ scheduledFor })
    .where(eq(meetings.id, meetingId))
}
