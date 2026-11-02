import type { PlantSpecies } from '@/features/trade-scenes/types'

import { LOT } from '@/features/trade-scenes/constants/home-lot'

export const PLANT_SPECIES = ['fan-palm', 'queen-palm', 'pygmy-palm', 'sago', 'agave', 'shrub', 'eucalyptus', 'cypress'] as const

// Where a plant stands on the ground, how big it is (its geometry is built about a metre tall, a bed plant at its own size)
// and how far it is turned about its trunk.
export type PlantPlacement = readonly [x: number, z: number, scale: number, turn: number]

// The street's tall trees, in other yards or the back of ours: they cast no shadow, because their crowns stand above
// LOT_SHADOW_BOX's top and the lot-fitted shadow camera cannot hold them. A double-tap passes through them.
export const FAR_PLANT_SPECIES: readonly PlantSpecies[] = ['fan-palm', 'queen-palm', 'eucalyptus', 'cypress']

// Metres. Hand-tuned working numbers. The bed plants keep out of every heat-arrow lane and every up-close view line.
export const PLANT_PLACEMENTS: Record<PlantSpecies, readonly PlantPlacement[]> = {
  'fan-palm': [[-12.5, -13, 15, 0], [5, -26, 17, 1], [24, -15, 13, 2], [-27, -20, 16, 3], [13, 40, 14, 4], [-33, 37, 15, 5], [40, -30, 16, 6], [-8, -46, 18, 7]],
  'queen-palm': [[-6.5, -20.5, 8.5, 0], [8.5, -21, 9, 1], [-28, 6, 9, 2], [29, 7, 8, 3], [-14, 30, 8, 4]],
  'pygmy-palm': [[LOT.left + 0.9, 6.5, 1.3, 0], [LOT.left + 1.2, 8.8, 1.1, 1.3], [-5.3, 4.75, 1.0, 2], [LOT.left + 1.4, -19, 1.6, 0.4], [LOT.left + 1.3, -15.5, 1.4, 2.2]],
  'sago': [[-2.35, 5.05, 0.7, 0], [3.9, 4.75, 1.0, 0], [LOT.left + 1.0, 4.6, 1.0, 2]],
  'agave': [[-3.25, 5.1, 0.65, 0], [2.15, 5.1, 0.8, 0], [4.3, 5.05, 0.9, 0], [LOT.left + 0.9, 7.6, 0.9, 0.5], [-4.85, 5.15, 0.6, 1.7]],
  'shrub': [[-2.85, 4.6, 0.8, 0], [2.15, 4.5, 0.6, 0], [0.72, 4.8, 0.5, Math.PI], [LOT.right - 1.3, -10, 1.3, 0], [LOT.left + 1.0, -8, 1.2, 1], [-3, LOT.back + 1.5, 1.4, 2], [6, LOT.back + 1.2, 1.5, 3]],
  'eucalyptus': [[-22, -40, 15, 0], [27, -42, 17, 1], [46, 6.5, 14, 2], [-45, -8, 16, 3], [3, -52, 14, 4], [-36, -48, 13, 5]],
  'cypress': [[-18.5, -12, 9, 0], [31, -13, 10, 1], [-38, 26, 9, 2]],
}

// Each species' parts, tuned by eye under the scene's light.
export const PLANT_PALETTE = {
  fanTrunk: '#8a7a66',
  fanSkirt: '#8d7351',
  fanFrond: '#5f7a3e',
  queenTrunk: '#9b9384',
  queenFrond: '#56753a',
  pygmyTrunk: '#6d5a45',
  pygmyFrond: '#5d7f3c',
  sagoFrond: '#3f6431',
  agaveLeaf: '#88a39a',
  shrubLeaf: '#5c7a40',
  shrubLeafLight: '#668545',
  eucalyptusBark: '#cfc6b4',
  eucalyptusBranch: '#cbc1ad',
  eucalyptusLeaf: '#6f7f5f',
  cypress: '#3c4b31',
} as const
