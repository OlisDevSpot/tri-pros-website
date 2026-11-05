'use client'

import type { ResidentAct, ResidentPlacement, ResidentSpec } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { OWN_PAINT } from '@/features/trade-scenes/constants/home-thermal-zones'
import { RESIDENT_BASE_CLIPS, RESIDENT_FIGURES } from '@/features/trade-scenes/constants/resident-clips'
import { BLANKET_COLORS, RESIDENT_OUTFITS, RESIDENT_SKIN } from '@/features/trade-scenes/constants/resident-looks'
import { CHILD_SCALE, RESIDENT_UNIT_SCALE } from '@/features/trade-scenes/constants/resident-placements'
import { residentPalette } from '@/features/trade-scenes/lib/resident-palette'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { ResidentBlanket } from '@/features/trade-scenes/ui/components/home-kit/resident-blanket'
import { ResidentStandIn } from '@/features/trade-scenes/ui/components/home-kit/resident-stand-in'
import { residentGestureClip } from '@/features/trade-scenes/ui/lib/resident-gesture-clip'
import { RESIDENT_THERMAL_PAINT } from '@/features/trade-scenes/ui/lib/resident-thermal-paint'
import { burstSettle } from '@/shared/components/scene/lib/burst-life'
import { AnimatedFigure } from '@/shared/components/scene/ui/animated-figure'
import { AssetBoundary } from '@/shared/components/scene/ui/asset-boundary'

interface ResidentProps {
  resident: ResidentSpec
  index: number
  placement: ResidentPlacement
  act: ResidentAct
  burst: SceneBurst
  thermal: boolean
}

export function Resident({ resident, index, placement, act, burst, thermal }: ResidentProps) {
  const figure = RESIDENT_FIGURES[resident.figure]
  const base = RESIDENT_BASE_CLIPS[placement.pose]
  const outfit = RESIDENT_OUTFITS[index % RESIDENT_OUTFITS.length]
  const standIn = <ResidentStandIn pose={placement.pose} color={outfit.top} skin={RESIDENT_SKIN[index % RESIDENT_SKIN.length]} />

  return (
    <group position={[...placement.position]} rotation={[0, placement.rotationY, 0]} scale={resident.role === 'child' ? CHILD_SCALE : 1}>
      <AssetBoundary fallback={standIn}>
        {/* A loaded figure paints itself under the thermal camera; its stand-in, if the model fails, takes the home's paint. */}
        <group scale={RESIDENT_UNIT_SCALE} userData={thermalTag(OWN_PAINT)}>
          <AnimatedFigure
            url={figure.url}
            clip={`${figure.clipPrefix}${base.clip}`}
            clipFrom={base.from}
            overlay={act.gesture ? residentGestureClip(act.gesture) : null}
            palette={residentPalette(resident, index)}
            running={burst.running}
            pace={() => burstSettle(burst.progress())}
            thermal={thermal ? RESIDENT_THERMAL_PAINT : undefined}
            fallback={<group scale={1 / RESIDENT_UNIT_SCALE} userData={thermalTag('resident')}>{standIn}</group>}
          />
        </group>
      </AssetBoundary>
      {act.blanket && <ResidentBlanket pose={placement.pose} color={BLANKET_COLORS[index % BLANKET_COLORS.length]} />}
    </group>
  )
}
