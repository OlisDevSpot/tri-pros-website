import type { SQL } from 'drizzle-orm'
import type { MeetingParticipantRole } from '@/shared/constants/enums'
import { and, eq, exists } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetingParticipants, user } from '@/shared/db/schema'

// ── Visibility Helper ───────────────────────────────────────────────────────

export function userParticipatesInMeeting(userId: string, meetingIdColumn: SQL | any): SQL {
  return exists(
    db.select({ id: meetingParticipants.id })
      .from(meetingParticipants)
      .where(and(
        eq(meetingParticipants.meetingId, meetingIdColumn),
        eq(meetingParticipants.userId, userId),
      )),
  )
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getParticipantsForMeeting(meetingId: string) {
  return db
    .select({
      id: meetingParticipants.id,
      userId: meetingParticipants.userId,
      role: meetingParticipants.role,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(meetingParticipants)
    .innerJoin(user, eq(user.id, meetingParticipants.userId))
    .where(eq(meetingParticipants.meetingId, meetingId))
}

export async function getParticipantEmails(meetingId: string): Promise<string[]> {
  const rows = await db
    .select({ email: user.email })
    .from(meetingParticipants)
    .innerJoin(user, eq(user.id, meetingParticipants.userId))
    .where(eq(meetingParticipants.meetingId, meetingId))

  return rows.map(r => r.email).filter((e): e is string => e !== null)
}

export async function getParticipantByRole(meetingId: string, role: MeetingParticipantRole) {
  return db.query.meetingParticipants.findFirst({
    where: and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.role, role),
    ),
  })
}

export async function countParticipantsByRole(meetingId: string, role: MeetingParticipantRole): Promise<number> {
  const rows = await db
    .select({ id: meetingParticipants.id })
    .from(meetingParticipants)
    .where(and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.role, role),
    ))

  return rows.length
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function addParticipant(
  meetingId: string,
  userId: string,
  role: MeetingParticipantRole,
): Promise<void> {
  await db.insert(meetingParticipants).values({ meetingId, userId, role })
}

export async function removeParticipant(meetingId: string, userId: string): Promise<void> {
  await db.delete(meetingParticipants).where(
    and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.userId, userId),
    ),
  )
}

export async function updateParticipantRole(
  meetingId: string,
  userId: string,
  newRole: MeetingParticipantRole,
): Promise<void> {
  await db.update(meetingParticipants)
    .set({ role: newRole })
    .where(and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.userId, userId),
    ))
}
