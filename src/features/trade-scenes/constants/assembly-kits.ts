import type { HomeAnchorId } from '@/features/trade-scenes/constants/home-anchors'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { ResolvedPart, Weather } from '@/shared/modules/construction/core/types'

import { roofAtticPartFocus } from '@/features/trade-scenes/lib/roof-attic-kit-points'

export interface AssemblyKit {
  anchor: HomeAnchorId
  // The weathers this kit can draw; in any other the home still shows the weather and the kit shows no flow.
  weathers: readonly Weather[]
  // Where an emphasised part sits at this peel, as an offset from the anchor in the world's axes; the camera leans toward
  // it. A kit without it keeps the anchor's framing while a part is emphasised.
  partFocus?: (form: string | null, part: Pick<ResolvedPart, 'id' | 'material'>, peel: number) => readonly [number, number, number] | null
}

// Kept free of three.js so the pure resolver and its scripts can read it; each kit's component is attached in a separate lazy map.
export const ASSEMBLY_KITS: Partial<Record<AssemblyId, AssemblyKit>> = {
  'roof-attic': { anchor: 'roof', weathers: ['normal', 'summer', 'winter', 'rain'], partFocus: roofAtticPartFocus },
}

// While a part is emphasised the camera's target moves this share of the way to it, and the camera closes in by this factor.
export const KIT_EMPHASIS_FRAMING = { share: 0.8, dolly: 0.78 } as const

export const KIT_MOTION = {
  // A tapped part stays whole; the rest fade back so it reads on its own.
  dimmedOpacity: 0.25,
  // An installed part drops into place from this far above.
  dropLift: 0.8,
  // Pins crowd a closed roof, so they show once it is this far open.
  pinsFromPeel: 0.2,
} as const
