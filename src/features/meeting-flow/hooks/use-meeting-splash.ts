'use client'

import { meetingSplashKey } from '@/features/meeting-flow/constants/splash'
import { useSessionOnce } from '@/shared/hooks/use-session-once'

/**
 * When the meeting splash shows (C39, E5, E9): the first time this meeting's route loads in a
 * browser tab, whatever the step, so a second meeting in the same tab still opens with it and a
 * deep link into a later step is not surprised by it on the way back to the first. One shared
 * store, so the mount (which renders it) and the view (which goes inert under it) read the same
 * `open`. `useSessionOnce` writes the key on the press, so a reload before the press shows it
 * again. Not a timer: E4 is a press. Open on the server: the meeting's first paint is the
 * splash (E9).
 */
export function useMeetingSplash(meetingId: string) {
  const [open, dismiss] = useSessionOnce(meetingSplashKey(meetingId), true, { openOnServer: true })
  return { open, dismiss }
}
