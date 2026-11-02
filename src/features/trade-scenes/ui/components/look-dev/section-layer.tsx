'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { Group } from 'three'
import type { LookDevOptions, SectionLayer as SectionLayerData } from '@/features/trade-scenes/types'

import { useEffect, useMemo, useRef } from 'react'

import { SECTION_DEPTH, SECTION_WIDTH } from '@/features/trade-scenes/constants/look-dev-section'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { createNoiseTexture } from '@/shared/components/scene/lib/create-noise-texture'
import { Slab } from '@/shared/components/scene/ui/slab'
import { ThermalMaterial } from '@/shared/components/scene/ui/thermal-material'

interface SectionLayerProps {
  layer: SectionLayerData
  thickness: number
  y: number
  options: LookDevOptions
  onEmphasize: (id: string) => void
}

export function SectionLayer({ layer, thickness, y, options, onEmphasize }: SectionLayerProps) {
  const ghosted = options.emphasized !== null && options.emphasized !== layer.id
  const opacity = ghosted ? 0.18 : 1
  const noise = options.treatment !== 'clay' && layer.texture !== 'smooth' ? layer.texture : null
  const texture = useMemo(() => (noise ? createNoiseTexture(noise, layer.color) : null), [noise, layer.color])
  useEffect(() => () => texture?.dispose(), [texture])

  // A unit box scaled into place, so a change of view grows the layer and slides the stack instead of
  // rebuilding the box at its new size.
  const slab = useRef<Group>(null)
  useEased([thickness, y + thickness / 2] as const, ([nextThickness, nextCentre]) => {
    slab.current?.scale.set(SECTION_WIDTH, nextThickness, SECTION_DEPTH)
    slab.current?.position.set(0, nextCentre, 0)
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (ghosted || event.delta > 6) {
      return
    }
    event.stopPropagation()
    onEmphasize(layer.id)
  }

  const [inner, outer] = layer.temperature[options.season][options.view]
  return (
    <group ref={slab}>
      <Slab size={[1, 1, 1]} position={[0, 0, 0]} onClick={handleClick}>
        {options.heat && options.renderer === 'webgl'
          ? <ThermalMaterial inner={inner} outer={outer} halfThickness={0.5} season={options.season} style={options.thermalStyle} opacity={opacity} />
          : (
              // three compiles `transparent` (the OPAQUE define) and the presence of a map into the program, so
              // either change needs a new material rather than a prop update.
              <meshStandardMaterial
                key={`${ghosted ? 'ghosted' : 'solid'}:${texture ? 'mapped' : 'plain'}`}
                color={texture ? '#ffffff' : layer.color}
                map={texture}
                roughness={options.treatment === 'studio' ? 0.7 : 0.9}
                transparent={opacity < 1}
                opacity={opacity}
                depthWrite={opacity > 0.5}
              />
            )}
      </Slab>
    </group>
  )
}
