'use client'

import { SplashOverlay } from '@/shared/components/splash-screen/splash-overlay'
import { useSplashVisibility } from '@/shared/components/splash-screen/use-splash-visibility'

interface ProposalSplashScreenProps {
  isAuthenticated: boolean
}

export function ProposalSplashScreen({ isAuthenticated }: ProposalSplashScreenProps) {
  const visible = useSplashVisibility(!isAuthenticated)
  return <SplashOverlay visible={visible} motionKey="proposal-splash" />
}
