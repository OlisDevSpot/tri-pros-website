'use client'

import type { SpotChipPlacement } from '@/features/trade-scenes/lib/spot-chip-placement'
import type { HomeSpotId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useSpotChipFree } from '@/features/trade-scenes/hooks/use-spot-chip-free'
import { homeSpotContext } from '@/features/trade-scenes/lib/keep-look-inside'
import { spotChipLine, spotChipPlacement } from '@/features/trade-scenes/lib/spot-chip-placement'
import { systemsAtSpot } from '@/features/trade-scenes/lib/systems-at-spot'
import { SpotChip } from '@/features/trade-scenes/ui/components/spot-chip/spot-chip'
import { SpotChipMark } from '@/features/trade-scenes/ui/components/spot-chip/spot-chip-mark'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface SpotChipsProps {
  spot: HomeSpotId
}

interface Placed {
  placement: SpotChipPlacement
  point: { x: number, y: number }
}

interface Line {
  from: { x: number, y: number }
  to: { x: number, y: number }
}

// One tap's chips, stood once. The anchor's element sits at the stage's top-left until the projector's next frame, so the
// stand waits for the element's first `data-anchored` and reads the point then, in the stage's own pixels. Every chip is
// then offset from the point, so it follows the point while the projector moves the element, and its side never changes.
// The projector sets the attribute every frame, so each frame's callback leaves state alone unless something changed. The
// canvas reaches left under the sidebar, past the stage, so the host judges the stage itself: a point out of it takes its
// chips with it.
export function SpotChips({ spot }: SpotChipsProps) {
  const systems = useSceneInputs(useShallow((state: TradeSceneInputs) => systemsAtSpot(spot, homeSpotContext(state))))
  const { stageElement } = useSceneVisibleArea()
  const editing = useSceneInputs((state: TradeSceneInputs) => state.tappedSpot?.editing ?? null)
  const free = useSpotChipFree()
  const latestFree = useRef(free)
  latestFree.current = free
  const root = useRef<HTMLDivElement>(null)
  const stood = useRef<Placed | null>(null)
  const lineDrawn = useRef(false)
  const hidden = useRef(false)
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [offStage, setOffStage] = useState(false)
  const [line, setLine] = useState<Line | null>(null)

  useEffect(() => {
    const pin = root.current?.parentElement
    if (!pin || !stageElement) {
      return
    }
    const read = () => {
      if (!pin.hasAttribute('data-anchored')) {
        return
      }
      const at = pin.getBoundingClientRect()
      const stage = stageElement.getBoundingClientRect()
      const out = at.left < stage.left || at.left > stage.right || at.top < stage.top || at.top > stage.bottom
      if (out !== hidden.current) {
        hidden.current = out
        setOffStage(out)
      }
      if (stood.current === null) {
        const point = { x: at.left - stage.left, y: at.top - stage.top }
        stood.current = {
          point,
          placement: spotChipPlacement({ point, free: latestFree.current, widest: SCENE_LAYOUT.spotChip.widest, foldedHeight: null, current: null }),
        }
        setPlaced(stood.current)
        return
      }
      const surface = lineDrawn.current ? null : root.current?.querySelector<HTMLElement>('[data-spot-chip-surface]')
      if (!surface) {
        return
      }
      lineDrawn.current = true
      const { placement, point } = stood.current
      const { nameRowHalf, edge } = SCENE_LAYOUT.spotChip
      const width = Math.min(surface.offsetWidth, placement.width)
      const standing = { ...placement, width, left: placement.side === 'left' ? placement.left + placement.width - width : placement.left }
      const { from, to } = spotChipLine(point, standing, { height: 2 * (nameRowHalf + edge) })
      setLine({ from: { x: from.x - point.x, y: from.y - point.y }, to: { x: to.x - point.x, y: to.y - point.y } })
    }
    const observer = new MutationObserver(read)
    observer.observe(pin, { attributes: true, attributeFilter: ['data-anchored'] })
    // An attribute already there fires no mutation; the read waits for a frame so no state is set in this effect's body.
    const frame = pin.hasAttribute('data-anchored') ? requestAnimationFrame(read) : null
    return () => {
      observer.disconnect()
      if (frame !== null) {
        cancelAnimationFrame(frame)
      }
    }
  }, [stageElement])

  // Quick edit opening, or flipping sides while open, runs the placement again with the held one: the side, corner and top
  // stay, and the top lifts only if the folded height no longer fits under it.
  const onFolded = useCallback((foldedHeight: number) => {
    const held = stood.current
    if (held === null) {
      return
    }
    const placement = spotChipPlacement({ point: held.point, free: latestFree.current, widest: SCENE_LAYOUT.spotChip.widest, foldedHeight, current: held.placement })
    if (placement.top !== held.placement.top || placement.maxHeight !== held.placement.maxHeight) {
      stood.current = { ...held, placement }
      // The line met the chip where it stood; the next frame draws it to where it stands now.
      lineDrawn.current = false
      setPlaced(stood.current)
    }
  }, [])

  const { stackStep } = SCENE_LAYOUT.spotChip
  // The chip in quick edit stands alone, in the stack's first place.
  const shown = editing === null ? systems : systems.filter(system => system === editing)
  return (
    <div ref={root} inert={offStage} className={cn('relative size-0 transition-opacity duration-150', offStage && 'pointer-events-none')} style={{ opacity: offStage ? 0 : 1 }}>
      {placed && (
        <>
          <SpotChipMark line={line} />
          {shown.map((system, stackIndex) => (
            <SpotChip
              key={system}
              system={system}
              side={placed.placement.side}
              width={placed.placement.width}
              maxHeight={placed.placement.maxHeight}
              editing={system === editing}
              onFolded={onFolded}
              offset={{
                left: (placed.placement.side === 'left' ? placed.placement.left + placed.placement.width : placed.placement.left) - placed.point.x,
                top: placed.placement.top - placed.point.y + stackIndex * stackStep,
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}
