'use client'

import type { MeetingStepConfig } from '@/features/meeting-flow/constants/step-config'
import { MEETING_SPLASH_COPY } from '@/features/meeting-flow/constants/splash'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'

interface MeetingSplashScreenProps {
  open: boolean
  /** The meeting has loaded (or failed) behind the splash; until then the cue is disabled (E10). */
  ready: boolean
  /** The step the flow opens on: its title and subheading are the caption (E6). */
  step: MeetingStepConfig
  onDismiss: () => void
}

/**
 * The curtain-up for a meeting (E1): the brand mark, then the opening step's title and
 * subheading (E6), held until the agent presses (E4) — and not before the meeting behind it has
 * loaded (E10). The primitive owns the press surface, the key handling and the reduced-motion
 * gate; this component only says which words, which step, and when it is ready.
 */
export function MeetingSplashScreen({ open, ready, step, onDismiss }: MeetingSplashScreenProps) {
  return (
    <SplashScreen
      dismiss={{ mode: 'press', label: MEETING_SPLASH_COPY.pressLabel, ready, pendingLabel: MEETING_SPLASH_COPY.pendingLabel }}
      open={open}
      subheading={step.subheading}
      title={step.title}
      onDismiss={onDismiss}
    />
  )
}
