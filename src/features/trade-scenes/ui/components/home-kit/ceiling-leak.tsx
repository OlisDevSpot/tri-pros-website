'use client'

import type { SceneBurst } from '@/shared/components/scene/types'

import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { LeakBucket } from '@/features/trade-scenes/ui/components/home-kit/leak-bucket'
import { LeakDrip } from '@/features/trade-scenes/ui/components/home-kit/leak-drip'
import { LeakStain } from '@/features/trade-scenes/ui/components/home-kit/leak-stain'

interface CeilingLeakProps {
  reachesInside: number
  topY: number
  burst: SceneBurst
}

// Where the rain walk gets past the ceiling: a stain over the living room and a drip into a bucket set under it.
export function CeilingLeak({ reachesInside, topY, burst }: CeilingLeakProps) {
  return (
    <group>
      {/* Only the soak reads cold under the thermal camera; the bucket and the drips sit at the room's temperature. */}
      <group userData={thermalTag('leak')}>
        <LeakStain reachesInside={reachesInside} topY={topY} />
      </group>
      <LeakDrip burst={burst} />
      <LeakBucket />
    </group>
  )
}
