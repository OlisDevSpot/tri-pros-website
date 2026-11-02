'use client'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { ventPipeStubCylinders } from '@/features/trade-scenes/lib/vent-pipe-stub-cylinders'
import { mergeCylinders } from '@/features/trade-scenes/ui/lib/merge-cylinders'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface VentPipeStubsProps {
  lowSlope: boolean
  covering: string | null
}

// The plumbing vents out through the roof: outside, so they show in every view.
export function VentPipeStubs({ lowSlope, covering }: VentPipeStubsProps) {
  const cylinders = useMemo(() => ventPipeStubCylinders(lowSlope, covering), [lowSlope, covering])
  const pipes = useOwnedGeometry(() => mergeCylinders(cylinders.pipes), [cylinders])
  const flashings = useOwnedGeometry(() => mergeCylinders(cylinders.flashings), [cylinders])

  return (
    <group>
      <mesh geometry={pipes} castShadow>
        <meshStandardMaterial color={HOME_PALETTE.pipe} roughness={0.6} />
      </mesh>
      <mesh geometry={flashings}>
        <meshStandardMaterial color={HOME_PALETTE.vent} roughness={0.8} />
      </mesh>
    </group>
  )
}
