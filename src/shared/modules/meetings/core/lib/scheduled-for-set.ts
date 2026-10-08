import type { Meeting } from '@/shared/db/schema'

/** The fact follows the instant, not the spelling: a same-time re-save (a calendar sync) keeps it. */
export function scheduledForSetByMove(
  current: Pick<Meeting, 'scheduledFor'>,
  patch: Partial<Pick<Meeting, 'scheduledFor'>>,
  now: Date,
): Partial<Pick<Meeting, 'scheduledForSetAt'>> {
  if (!patch.scheduledFor || new Date(current.scheduledFor).getTime() === new Date(patch.scheduledFor).getTime()) {
    return {}
  }
  return { scheduledForSetAt: now.toISOString() }
}
