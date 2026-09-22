'use client'

import { MEETING_SPLASH_COPY } from '@/features/meeting-flow/constants/splash'
import { MEETING_STEPS } from '@/features/meeting-flow/constants/step-config'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'

interface MeetingSplashScreenProps {
  open: boolean
  onDismiss: () => void
}

/**
 * The curtain-up for a meeting (E1): the brand mark, then the opening step's title and
 * subheading from `MEETING_STEPS` (E6), held until the agent presses (E4). The primitive owns
 * the press surface, the key handling and the reduced-motion gate; this component only says
 * which words and which step.
 */
export function MeetingSplashScreen({ open, onDismiss }: MeetingSplashScreenProps) {
  const opening = MEETING_STEPS[0]
  return (
    <SplashScreen
      dismiss={{ mode: 'press', label: MEETING_SPLASH_COPY.pressLabel }}
      motionKey="meeting-splash"
      open={open}
      subheading={opening.subheading}
      title={opening.title}
      onDismiss={onDismiss}
    />
  )
}
