import type { SQL } from 'drizzle-orm'
import type { MeetingParticipantRole } from '@/shared/constants/enums'
import type { DbOrTx } from '@/shared/db'
import { and, asc, eq, exists, inArray, or } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetingParticipants, user } from '@/shared/db/schema'

// Visibility helper — see ../../DOCS.md#visibility-via-participation
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

/** Boolean check (vs embeddable SQL via `userParticipatesInMeeting`). */
export async function isParticipant(meetingId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: meetingParticipants.id })
    .from(meetingParticipants)
    .where(and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.userId, userId),
    ))
    .limit(1)

  return row !== undefined
}

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

export interface OwnerCoOwnerRow {
  meetingId: string
  participantId: string
  userId: string
  role: 'co_owner' | 'owner'
  userName: string
  userEmail: string
  userImage: string | null
}

/**
 * Batch-fetch owner + co_owner for a set of meetings. Use this instead of
 * LEFT JOIN — see ../../DOCS.md anti-patterns. Ordered by created_at ASC so
 * defensive callers that pick first-per-(meeting, role) get deterministic results.
 */
export async function getOwnerCoOwnerForMeetings(meetingIds: string[]): Promise<OwnerCoOwnerRow[]> {
  if (meetingIds.length === 0) {
    return []
  }

  const rows = await db
    .select({
      meetingId: meetingParticipants.meetingId,
      participantId: meetingParticipants.id,
      userId: meetingParticipants.userId,
      role: meetingParticipants.role,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(meetingParticipants)
    .innerJoin(user, eq(user.id, meetingParticipants.userId))
    .where(and(
      inArray(meetingParticipants.meetingId, meetingIds),
      or(
        eq(meetingParticipants.role, 'owner'),
        eq(meetingParticipants.role, 'co_owner'),
      ),
    ))
    .orderBy(asc(meetingParticipants.createdAt))

  // Narrow the role enum to owner | co_owner. The WHERE clause already filters
  // these out at the DB level; this is just a type-level guard.
  const result: OwnerCoOwnerRow[] = []
  for (const r of rows) {
    if (r.role === 'owner' || r.role === 'co_owner') {
      result.push({ ...r, role: r.role })
    }
  }
  return result
}

export interface MeetingParticipantRow {
  meetingId: string
  participantId: string
  userId: string
  role: MeetingParticipantRole
  userName: string
  userEmail: string
  userImage: string | null
}

/** Batch-fetch ALL participants. Ordered by user.id ASC for deterministic combo keys (swimlane grouping). */
export async function getAllParticipantsForMeetings(meetingIds: string[]): Promise<MeetingParticipantRow[]> {
  if (meetingIds.length === 0) {
    return []
  }

  return db
    .select({
      meetingId: meetingParticipants.meetingId,
      participantId: meetingParticipants.id,
      userId: meetingParticipants.userId,
      role: meetingParticipants.role,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(meetingParticipants)
    .innerJoin(user, eq(user.id, meetingParticipants.userId))
    .where(inArray(meetingParticipants.meetingId, meetingIds))
    .orderBy(asc(user.id))
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function addParticipant(
  meetingId: string,
  userId: string,
  role: MeetingParticipantRole,
  executor: DbOrTx = db,
): Promise<void> {
  await executor.insert(meetingParticipants).values({ meetingId, userId, role })
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
