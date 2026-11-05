'use client'

import type { SceneTapClaim } from '@/features/trade-scenes/contexts/scene-tap-claim-context'

import { use } from 'react'

import { SceneTapClaimContext } from '@/features/trade-scenes/contexts/scene-tap-claim-context'

export function useSceneTapClaim(): SceneTapClaim {
  const claim = use(SceneTapClaimContext)
  if (!claim) {
    throw new Error('useSceneTapClaim must be used inside a SceneTapClaimProvider')
  }
  return claim
}
