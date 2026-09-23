import { sessionStorageKey } from '@/shared/constants/storage-keys'

export const MEETING_SPLASH_COPY = {
  /** The cue button's text and accessible name once the meeting has loaded: its action (review N3). */
  pressLabel: 'Begin the presentation',
  /** The cue's text while the meeting is still loading behind the splash (E10). */
  pendingLabel: 'Loading the presentation…',
} as const

/**
 * E10 fails open: a loading state that cannot end is a lock. The cue arms when the meeting
 * query settles — success, or its retries exhausted (~10 s at React Query's defaults) — and in
 * any case after this bound, whatever the query says.
 */
export const MEETING_SPLASH_READY_BOUND_MS = 15_000

/** Once per meeting per browser tab (E5), written on the press: `tri-pros:meeting-splash:<meetingId>`. */
export function meetingSplashKey(meetingId: string): string {
  return sessionStorageKey('meeting-splash', meetingId)
}
