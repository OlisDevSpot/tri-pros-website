'use client'

import { FAR_PLANT_SPECIES, PLANT_PLACEMENTS, PLANT_SPECIES } from '@/features/trade-scenes/constants/lot-plants'
import { PlantInstances } from '@/features/trade-scenes/ui/components/home-kit/plant-instances'

export function LotPlants() {
  return (
    <group>
      {PLANT_SPECIES.map(species => (
        <PlantInstances key={species} species={species} placements={PLANT_PLACEMENTS[species]} far={FAR_PLANT_SPECIES.includes(species)} />
      ))}
    </group>
  )
}
