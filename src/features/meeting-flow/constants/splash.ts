import { sessionStorageKey } from '@/shared/constants/storage-keys'

export const MEETING_SPLASH_COPY = {
  /** The press button's accessible name: its action. The caption is its description (review N3). */
  pressLabel: 'Begin the presentation',
} as const

/** Once per meeting per browser session (E5): `tri-pros:meeting-splash:<meetingId>`, written on the press. */
export function meetingSplashKey(meetingId: string): string {
  return sessionStorageKey('meeting-splash', meetingId)
}
