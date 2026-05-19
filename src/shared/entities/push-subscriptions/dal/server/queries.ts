import type { PushSubscriptionRow } from '@/shared/db/schema/push-subscriptions'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { pushSubscriptions } from '@/shared/db/schema/push-subscriptions'

export type { PushSubscriptionRow }

export interface UpsertPushSubscriptionInput {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
  platform?: string | null
  /**
   * If the browser rotated endpoints (pushsubscriptionchange / re-subscribe),
   * pass the previous endpoint so we delete its row before upsert. Without
   * this we'd leave an orphan that no longer maps to a real subscription.
   */
  replacedEndpoint?: string | null
}

// Endpoint is the natural unique key. On conflict we reassign userId because
// the same browser may be shared (user A subscribes, signs out, user B signs
// in and re-subscribes with the same endpoint).
export async function upsertPushSubscription(input: UpsertPushSubscriptionInput): Promise<PushSubscriptionRow> {
  return db.transaction(async (tx) => {
    if (input.replacedEndpoint && input.replacedEndpoint !== input.endpoint) {
      await tx
        .delete(pushSubscriptions)
        .where(
          eq(pushSubscriptions.endpoint, input.replacedEndpoint),
        )
    }

    const [row] = await tx
      .insert(pushSubscriptions)
      .values({
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        platform: input.platform ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: input.userId,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
          platform: input.platform ?? null,
        },
      })
      .returning()

    return row
  })
}

// Scoped to caller — a user can only delete their own subscriptions.
export async function deletePushSubscriptionForUser(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
}

export async function getPushSubscriptionsByUser(userId: string): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
}

export async function getPushSubscriptionsByUsers(userIds: string[]): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) {
    return []
  }
  return db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))
}

// Bulk delete by endpoint — used by the send helper to prune dead subscriptions
// after the push service returns 401/403/404/410.
export async function deletePushSubscriptionsByEndpoint(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) {
    return
  }
  await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, endpoints))
}

// Touch lastSuccessAt for the endpoints that just delivered. Best-effort —
// we don't await this on the caller's critical path.
export async function markPushSuccess(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) {
    return
  }
  await db
    .update(pushSubscriptions)
    .set({ lastSuccessAt: new Date().toISOString() })
    .where(inArray(pushSubscriptions.endpoint, endpoints))
}

// Touch lastFailureAt for endpoints that returned a non-fatal error (5xx,
// transient network failure, etc.). Useful for spotting stuck devices in
// metrics without deleting the row.
export async function markPushFailure(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) {
    return
  }
  await db
    .update(pushSubscriptions)
    .set({ lastFailureAt: new Date().toISOString() })
    .where(inArray(pushSubscriptions.endpoint, endpoints))
}
