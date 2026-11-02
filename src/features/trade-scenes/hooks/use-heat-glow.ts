'use client'

import type { RefObject } from 'react'
import type { MeshStandardMaterial } from 'three'

import { useRef } from 'react'

import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { useEased } from '@/shared/components/scene/hooks/use-eased'

// A heating element's glow eases to the load it is carrying, so a view change warms or cools it instead of switching it.
export function useHeatGlow(load: number): RefObject<MeshStandardMaterial | null> {
  const material = useRef<MeshStandardMaterial>(null)
  useEased(load * EQUIPMENT_STRAIN.heat.intensity, (value) => {
    if (material.current) {
      material.current.emissiveIntensity = value
    }
  })
  return material
}
