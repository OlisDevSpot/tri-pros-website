'use client'

import { PROPOSAL_SPLASH_KEY } from '@/features/proposal-flow/constants/splash'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'
import { useSessionOnce } from '@/shared/hooks/use-session-once'

interface ProposalSplashScreenProps {
  isAuthenticated: boolean
}

/** The timed brand splash a homeowner sees once per session when opening a proposal link; a signed-in agent never does. */
export function ProposalSplashScreen({ isAuthenticated }: ProposalSplashScreenProps) {
  const [open, onDismiss] = useSessionOnce(PROPOSAL_SPLASH_KEY, !isAuthenticated)
  return <SplashScreen dismiss={{ mode: 'timed' }} open={open} onDismiss={onDismiss} />
}
