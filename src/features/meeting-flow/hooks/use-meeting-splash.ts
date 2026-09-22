'use client'

import { meetingSplashKey } from '@/features/meeting-flow/constants/splash'
import { MEETING_STEPS } from '@/features/meeting-flow/constants/step-config'
import { useSessionOnce } from '@/shared/hooks/use-session-once'

interface UseMeetingSplashArgs {
  meetingId: string
  currentStep: number
}

/**
 * When the meeting splash shows (C39, E5, E8): the first time the flow is on its opening step in
 * a browser session, once per meeting, so a second meeting in the same session still opens with
 * it. `useSessionOnce` writes the key on the press, so a reload before the press shows it again.
 * Not a timer: E4 is a press.
 */
export function useMeetingSplash({ meetingId, currentStep }: UseMeetingSplashArgs) {
  const [open, dismiss] = useSessionOnce(meetingSplashKey(meetingId), currentStep === MEETING_STEPS[0].stepNumber)
  return { open, dismiss }
}
