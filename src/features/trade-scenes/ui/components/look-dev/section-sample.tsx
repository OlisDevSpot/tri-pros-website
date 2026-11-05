'use client'

import type { LookDevOptions } from '@/features/trade-scenes/types'

import { PROPOSED_INSULATION_THICKNESS, ROOF_RISE, SECTION_LAYERS, SECTION_PITCH } from '@/features/trade-scenes/constants/look-dev-section'
import { SectionLayer } from '@/features/trade-scenes/ui/components/look-dev/section-layer'

interface SectionSampleProps {
  options: LookDevOptions
  onEmphasize: (id: string) => void
}

function stack(group: 'roof' | 'attic', options: LookDevOptions) {
  let y = 0
  return SECTION_LAYERS.filter(layer => layer.group === group).map((layer) => {
    const thickness = layer.id === 'insulation' && options.view === 'proposed' ? PROPOSED_INSULATION_THICKNESS : layer.thickness
    const placed = { layer, thickness, y }
    y += thickness
    return placed
  })
}

export function SectionSample({ options, onEmphasize }: SectionSampleProps) {
  return (
    <group position={[0, -0.6, 0]}>
      {stack('attic', options).map(({ layer, thickness, y }) => (
        <SectionLayer key={layer.id} layer={layer} thickness={thickness} y={y} options={options} onEmphasize={onEmphasize} />
      ))}
      <group position={[0, ROOF_RISE, 0]} rotation={[0, 0, SECTION_PITCH]}>
        {stack('roof', options).map(({ layer, thickness, y }) => (
          <SectionLayer key={layer.id} layer={layer} thickness={thickness} y={y} options={options} onEmphasize={onEmphasize} />
        ))}
      </group>
    </group>
  )
}
