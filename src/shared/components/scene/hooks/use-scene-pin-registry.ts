'use client'

import type { ScenePinRegistry } from '@/shared/components/scene/types'

import { useState } from 'react'

import { createScenePinRegistry } from '@/shared/components/scene/lib/create-scene-pin-registry'

export function useScenePinRegistry(): ScenePinRegistry {
  const [registry] = useState(createScenePinRegistry)
  return registry
}
