'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'

import { PART_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { PEEL_SLIDER_STEPS } from '@/features/trade-scenes/constants/scene-controls'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'
import { Slider } from '@/shared/components/ui/slider'

// A slider for the slow reveal while talking, and one tap to open or close it fully. Each move writes only the peel, which
// nothing resolves from, so dragging never recomputes the scene.
export function PeelControl() {
  const peel = useSceneInputs((state: TradeSceneInputs) => state.peel)
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const labelId = useId()
  const open = peel > 0.5

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{PART_COPY.peel}</span>
        <Button variant="ghost" className="min-h-11 text-(--presentation-accent)" onClick={() => inputs.setState({ peel: open ? 0 : 1 })}>
          {open ? PART_COPY.close : PART_COPY.open}
        </Button>
      </div>
      <Slider
        value={[peel * PEEL_SLIDER_STEPS]}
        onValueChange={([next]) => inputs.setState({ peel: (next ?? 0) / PEEL_SLIDER_STEPS })}
        max={PEEL_SLIDER_STEPS}
        step={1}
        thumbProps={{ 'aria-labelledby': labelId }}
        className="h-11 **:data-[slot=slider-range]:bg-(--presentation-accent) **:data-[slot=slider-thumb]:size-7 **:data-[slot=slider-thumb]:border-(--presentation-accent) **:data-[slot=slider-track]:h-2"
      />
    </div>
  )
}
