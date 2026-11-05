'use client'

import type { SceneTargets } from '@/features/trade-scenes/types'

import { use } from 'react'

import { SceneTargetsContext } from '@/features/trade-scenes/contexts/scene-targets-context'

export function useSceneTargets(): SceneTargets {
  const targets = use(SceneTargetsContext)
  if (!targets) {
    throw new Error('useSceneTargets must be used inside a SceneTargetsProvider')
  }
  return targets
}
