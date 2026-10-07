import type { Meeting } from '@/shared/db/schema'

type CurrentConfirmations = Pick<Meeting, 'scheduledFor' | 'confirmedAt' | 'homeownerConfirmedAt'>
type ConfirmationPatch = Partial<Pick<Meeting, 'scheduledFor' | 'confirmedAt' | 'homeownerConfirmedAt' | 'homeownerConfirmedVia'>>

/**
 * A confirmation holds for one appointment time, the office's and the homeowner's alike.
 * Times compare as instants, so a same-time re-save (a calendar sync) keeps both.
 */
export function confirmationsClearedByMove(current: CurrentConfirmations, patch: ConfirmationPatch): ConfirmationPatch {
  if (!patch.scheduledFor || new Date(current.scheduledFor).getTime() === new Date(patch.scheduledFor).getTime()) {
    return {}
  }
  return {
    ...(current.confirmedAt && !('confirmedAt' in patch) ? { confirmedAt: null } : {}),
    ...(current.homeownerConfirmedAt && !('homeownerConfirmedAt' in patch)
      ? { homeownerConfirmedAt: null, homeownerConfirmedVia: null }
      : {}),
  }
}
