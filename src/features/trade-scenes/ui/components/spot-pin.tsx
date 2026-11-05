'use client'

import { ScanSearchIcon } from 'lucide-react'

import { LOOK_INSIDE_SYSTEM_IDS, SPOT_OF } from '@/features/trade-scenes/constants/home-systems'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { Button } from '@/shared/components/ui/button'

interface SpotPinProps {
  system: (typeof LOOK_INSIDE_SYSTEM_IDS)[number]
  label: string
}

// The systems one spot opens stand one above another, its first on its own point: the roof's and the attic's points are a
// pin's width apart at most, and on a phone one would hide the other. A step is the pin's height and a small gap: a working
// number, set by eye.
const STACK_STEP_REM = 3
const STACKED = Object.fromEntries(LOOK_INSIDE_SYSTEM_IDS.map(system => [system, LOOK_INSIDE_SYSTEM_IDS.filter(other => SPOT_OF[other] === SPOT_OF[system]).indexOf(system)])) as Record<SpotPinProps['system'], number>

// A tap target pinned where the house was tapped, one for each system there; the pulse says it leads somewhere, and stops
// for reduced motion. It picks the system as its rail chip does, and claims its tap, which lands on the scene too, so an open
// Systems stays open; it reads the controls itself, so the canvas under it never re-renders with them.
//
// The box has no size, so the projector's centring leaves its origin on the spot, and the pin hangs its icon there with the
// label running right: the equipment and the windows stand near the scene's left edge, where a pin centred on its spot
// would run off it. The shift is the icon's centre: the border, the left padding and half the icon.
export function SpotPin({ system, label }: SpotPinProps) {
  const { pickFromPin } = useSceneControls()
  const { claimTap } = useSceneTapClaim()
  const select = () => {
    claimTap()
    pickFromPin(system)
  }
  return (
    <div className="relative size-0">
      <Button data-spot-pin={system} variant="outline" onClick={select} style={{ top: `${-STACKED[system] * STACK_STEP_REM}rem` }} className="absolute left-0 min-h-11 w-max -translate-x-5.75 -translate-y-1/2 gap-2 rounded-full py-1.5 pr-4 pl-1.5 shadow-lg">
        <span className="relative grid size-8 place-items-center rounded-full bg-(--presentation-accent) text-primary-foreground">
          <span aria-hidden className="absolute inset-0 rounded-full bg-(--presentation-accent) opacity-50 motion-safe:animate-ping" />
          <ScanSearchIcon aria-hidden className="relative size-4" />
        </span>
        {label}
      </Button>
    </div>
  )
}
