'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { Ref } from 'react'
import type { Group } from 'three'
import type { CoveringWear, DrawnGutter, PaintLook, SystemLit } from '@/features/trade-scenes/types'
import type { SpotHover } from '@/features/trade-scenes/ui/components/home-kit/spot-hover'
import type { SceneBurst } from '@/shared/components/scene/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { ResolvedPart, ShingleColorId } from '@/shared/modules/construction/core/types'

import { useMemo } from 'react'

import { ATTIC_FAN_SPOT } from '@/features/trade-scenes/constants/home-geometry'
import { coveringLook } from '@/features/trade-scenes/lib/covering-look'
import { installedShingleTone } from '@/features/trade-scenes/lib/installed-shingle-tone'
import { drawnGutterWear, partState } from '@/features/trade-scenes/lib/part-state'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { AtticFan } from '@/features/trade-scenes/ui/components/home-kit/attic-fan'
import { AtticFloor } from '@/features/trade-scenes/ui/components/home-kit/attic-floor'
import { AtticOpenings } from '@/features/trade-scenes/ui/components/home-kit/attic-openings'
import { GableRoof } from '@/features/trade-scenes/ui/components/home-kit/gable-roof'
import { LowSlopeRoof } from '@/features/trade-scenes/ui/components/home-kit/low-slope-roof'
import { VentPipeStubs } from '@/features/trade-scenes/ui/components/home-kit/vent-pipe-stubs'

interface HouseRoofProps {
  form: string | null
  parts: readonly ResolvedPart[]
  // The levels the covering's kinds of wear are drawn at; the covering shows them only where it is old or reused.
  coveringWear: CoveringWear
  // A tap on the roof asks which systems are there.
  onTap: (event: ThreeEvent<MouseEvent>) => void
  hover: SpotHover
  // Holds the attic floor, which the home hides whenever nothing can see into the attic.
  attic: Ref<Group>
  // Holds a flat roof's front fascia marks, which the home hides while the closed front parapet covers them.
  behindParapet: Ref<Group>
  shingleColor: ShingleColorId | null
  // The gutters' and downspouts' colour, before they wear.
  gutterHex: string
  paint: PaintLook
  stucco: boolean
  // The new fascia boards' colour where the build replaced the rotted fascia; null where it did not.
  fasciaBoards: string | null
  // The wear whose overflow stains a gable's fascia, null where nothing does.
  fasciaOverflow: Wear | null
  thermal: boolean
  atticFanRunning: boolean
  burst: SceneBurst
  // Whether the home has ducts in the attic, and so register boots through its ceiling.
  ducted: boolean
  // Whether foam closes the ceiling's openings, which it does before any insulation goes down; the cutaway shows it where
  // the blanket is cut back. A flat roof never resolves an air sealing part.
  airSealed: boolean
  // Whether the ceiling still leaks air, which leaves dust round each opening.
  dusty: boolean
  // The system up close, whose system parts step open on the roof and the attic floor; held while it leaves, so the steps
  // ease shut with its ghost.
  lit: SystemLit | null
  // Whether it rains, so the eave sheds the roof's water wherever no gutter catches it.
  raining: boolean
}

// The form and every part come from the resolved roof, never the profile: metal arrives here already drawn as its nearest covering.
export function HouseRoof({ form, parts, coveringWear, onTap, hover, attic, behindParapet, shingleColor, gutterHex, paint, stucco, fasciaBoards, fasciaOverflow, thermal, atticFanRunning, burst, ducted, airSealed, dusty, lit, raining }: HouseRoofProps) {
  const lowSlope = form === 'low-slope'
  const covering = useMemo(() => coveringLook(parts, coveringWear), [parts, coveringWear])
  const deck = partState(parts, 'deck')
  const gutterWear = drawnGutterWear(parts)
  const gutter = useMemo<DrawnGutter | null>(() => gutterWear === null ? null : { wear: gutterWear, hex: gutterHex }, [gutterWear, gutterHex])
  const fanned = !lowSlope && partState(parts, 'attic-fan').material !== null
  const insulation = partState(parts, 'attic-insulation')
  const over = parts.find(part => part.id === 'attic-insulation')?.over ?? null
  const underlayment = partState(parts, 'underlayment')

  return (
    <group onClick={onTap} {...hover} userData={thermalTag('roof')}>
      <group ref={attic}>
        <AtticFloor lowSlope={lowSlope} insulation={insulation} over={over} lit={lit} dusty={dusty} ducted={ducted} thermal={thermal} />
        <group userData={thermalTag('attic')}>
          <AtticOpenings lowSlope={lowSlope} ducted={ducted} collars={airSealed} lit={lit} />
        </group>
        {/* Its own tag: the roof's would paint it roof-hot. */}
        {fanned && (
          <group position={[...ATTIC_FAN_SPOT.position]} rotation={[0, ATTIC_FAN_SPOT.rotationY, 0]} userData={thermalTag('attic', 'attic-fan')}>
            <AtticFan running={atticFanRunning} burst={burst} />
          </group>
        )}
      </group>
      <VentPipeStubs lowSlope={lowSlope} covering={covering.material} />
      {lowSlope
        ? <LowSlopeRoof covering={covering} deck={deck} underlayment={underlayment} gutter={gutter} paint={paint} stucco={stucco} fasciaBoards={fasciaBoards} behindParapet={behindParapet} thermal={thermal} lit={lit} />
        : (
            <GableRoof
              covering={covering}
              deck={deck}
              underlayment={underlayment}
              radiantBarrier={partState(parts, 'radiant-barrier')}
              ridgeVent={partState(parts, 'ridge-vent')}
              gutter={gutter}
              dripEdge={partState(parts, 'drip-edge')}
              iceAndWater={partState(parts, 'ice-and-water')}
              shingleTone={installedShingleTone(parts, shingleColor)}
              paint={paint}
              stucco={stucco}
              fasciaBoards={fasciaBoards}
              fasciaOverflow={fasciaOverflow}
              thermal={thermal}
              lit={lit}
              raining={raining}
              running={burst.running}
            />
          )}
    </group>
  )
}
