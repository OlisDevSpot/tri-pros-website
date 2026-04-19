import type { inferRouterOutputs } from '@trpc/server'

import type { InitialParticipantSummary } from './types'
import type { AppRouter } from '@/trpc/routers/app'

type ParticipantsCache = inferRouterOutputs<AppRouter>['meetingsRouter']['getParticipants']

/**
 * Builds a `ParticipantsCache`-shaped array from optional owner / co-owner
 * snapshots so it can be used as React Query `placeholderData` / `initialData`.
 *
 * Returns `null` when neither snapshot is present so callers can fall back to
 * the normal loading state instead of seeding an empty cache.
 *
 * Note: the resulting array does NOT include helper participants — the real
 * `getParticipants` fetch is still required for an accurate helper count.
 * That's why the picker uses `placeholderData` (background refetch) rather
 * than `initialData` (treats as fresh).
 */
export function buildPlaceholderParticipants(
  initialOwner: InitialParticipantSummary | null | undefined,
  initialCoOwner: InitialParticipantSummary | null | undefined,
): ParticipantsCache | null {
  if (!initialOwner && !initialCoOwner) {
    return null
  }

  const placeholders: ParticipantsCache = []

  if (initialOwner) {
    placeholders.push({
      id: initialOwner.id,
      userId: initialOwner.userId,
      role: 'owner',
      userName: initialOwner.userName ?? '',
      userEmail: initialOwner.userEmail ?? '',
      userImage: initialOwner.userImage,
    })
  }

  if (initialCoOwner) {
    placeholders.push({
      id: initialCoOwner.id,
      userId: initialCoOwner.userId,
      role: 'co_owner',
      userName: initialCoOwner.userName ?? '',
      userEmail: initialCoOwner.userEmail ?? '',
      userImage: initialCoOwner.userImage,
    })
  }

  return placeholders
}
