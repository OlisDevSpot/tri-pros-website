'use client'

import type { ResidentAct, ResidentSpec } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { RESIDENT_PLACEMENTS } from '@/features/trade-scenes/constants/resident-placements'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { Resident } from '@/features/trade-scenes/ui/components/home-kit/resident'

interface ResidentsProps {
  residents: readonly ResidentSpec[]
  act: ResidentAct
  burst: SceneBurst
  thermal: boolean
}

// Adults take the sofa and then the kitchen table in cast order, children the rug; a cast larger than the spots stops there.
export function Residents({ residents, act, burst, thermal }: ResidentsProps) {
  const adults = residents.filter(resident => resident.role === 'adult')
  const children = residents.filter(resident => resident.role === 'child')
  const placed = [
    ...adults.slice(0, RESIDENT_PLACEMENTS.adults.length).map((resident, at) => ({ resident, placement: RESIDENT_PLACEMENTS.adults[at] })),
    ...children.slice(0, RESIDENT_PLACEMENTS.children.length).map((resident, at) => ({ resident, placement: RESIDENT_PLACEMENTS.children[at] })),
  ]

  return (
    <group userData={thermalTag('resident')}>
      {placed.map(({ resident, placement }, index) => (
        <Resident key={resident.id} resident={resident} index={index} placement={placement} act={act} burst={burst} thermal={thermal} />
      ))}
    </group>
  )
}
