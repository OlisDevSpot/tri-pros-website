import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema/activities'

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getSyncableActivitiesForUser(userId: string) {
  return db.select().from(activities).where(
    and(eq(activities.ownerId, userId), isNotNull(activities.scheduledFor)),
  )
}

export async function getActivityById(activityId: string) {
  return db.query.activities.findFirst({
    where: eq(activities.id, activityId),
  })
}

export async function getActivityByGCalEventId(gcalEventId: string) {
  return db.query.activities.findFirst({
    where: eq(activities.gcalEventId, gcalEventId),
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

export async function updateActivityGCalFields(
  activityId: string,
  fields: { gcalEventId?: string | null, gcalEtag?: string | null, gcalSyncedAt?: string | null },
): Promise<void> {
  await db.update(activities)
    .set(fields)
    .where(eq(activities.id, activityId))
}

export async function clearActivityGCalFields(activityId: string): Promise<void> {
  await db.update(activities)
    .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
    .where(eq(activities.id, activityId))
}

export async function clearAllActivityGCalFieldsForUser(userId: string): Promise<void> {
  await db.update(activities)
    .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
    .where(eq(activities.ownerId, userId))
}

export async function updateActivityFromGCal(
  activityId: string,
  fields: { scheduledFor?: string | null, gcalEtag?: string | null, gcalSyncedAt?: string | null },
): Promise<void> {
  await db.update(activities)
    .set(fields)
    .where(eq(activities.id, activityId))
}

export async function createActivityFromGCalEvent(
  data: typeof activities.$inferInsert,
): Promise<void> {
  await db.insert(activities).values(data)
}

export async function deleteActivity(activityId: string): Promise<void> {
  await db.delete(activities).where(eq(activities.id, activityId))
}
