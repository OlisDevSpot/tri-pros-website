import { sessionStorageKey } from '@/shared/constants/storage-keys'

export const MEETING_SPLASH_COPY = {
  /** The cue button's text and accessible name once the meeting has loaded: its action (review N3). */
  pressLabel: 'Begin the presentation',
  /** The cue's text while the meeting is still loading behind the splash (E10). */
  pendingLabel: 'Loading the presentation…',
} as const

/** Once per meeting per browser tab (E5), written on the press: `tri-pros:meeting-splash:<meetingId>`. */
export function meetingSplashKey(meetingId: string): string {
  return sessionStorageKey('meeting-splash', meetingId)
}
