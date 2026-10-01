import type { inferRouterOutputs } from '@trpc/server'

import type { InitialParticipantSummary } from './types'
import type { AppRouter } from '@/trpc/routers/app'

type ParticipantsCache = inferRouterOutputs<AppRouter>['meetingsRouter']['participants']['getParticipants']

/**
 * Shapes the owner / co-owner a row already carries like a `getParticipants` result, so a table can
 * show them without one request per row.
 *
 * Returns `null` when neither is present, so callers fetch and show their loading state rather than
 * an empty list that reads as "no participants".
 *
 * The snapshot has no helpers, so it stands in only where helpers are not shown: the read-only
 * summary seeds it as `initialData`, and the picker shows it while closed and fetches the full list
 * when it opens.
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
