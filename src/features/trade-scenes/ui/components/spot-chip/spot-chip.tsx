'use client'

import type { HomeSystemId } from '@/features/trade-scenes/types'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { QuickEdit } from '@/features/trade-scenes/ui/components/spot-chip/quick-edit'
import { SpotChipHead } from '@/features/trade-scenes/ui/components/spot-chip/spot-chip-head'

interface SpotChipProps {
  system: HomeSystemId
  // From the point to the chip's near corner.
  offset: { left: number, top: number }
  // Which way the chip stands from the point; a chip left of it hangs from its right edge, so the gap holds at any width.
  side: 'right' | 'left' | 'below'
  // The placement's width and the most height it leaves, both for quick edit.
  width: number
  maxHeight: number
  editing: boolean
  onFolded: (height: number) => void
}

export function SpotChip({ system, offset, side, width, maxHeight, editing, onFolded }: SpotChipProps) {
  const reduced = useReducedMotion()
  const { claimTap } = useSceneTapClaim()
  const { enterMs, slide, sizeMs, edge } = SCENE_LAYOUT.spotChip
  const from = side === 'right' ? -slide : side === 'left' ? slide : 0
  const inner = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number, height: number } | null>(null)

  // The content stands at its final size while the box grows to it, so the words never reflow mid-motion.
  useEffect(() => {
    const content = inner.current
    if (!content) {
      return
    }
    const observer = new ResizeObserver(() => {
      setSize(held => held?.width === content.offsetWidth && held.height === content.offsetHeight ? held : { width: content.offsetWidth, height: content.offsetHeight })
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const sizing = reduced ? { duration: 0 } : { duration: sizeMs / 1000, ease: CONTROLS_EASE }
  return (
    <motion.div className="absolute" style={{ left: offset.left }} initial={false} animate={{ top: offset.top }} transition={sizing}>
      <motion.div
        data-spot-chip-surface={system}
        onClickCapture={claimTap}
        initial={reduced ? false : { opacity: 0, x: from }}
        animate={{ opacity: 1, x: 0, ...size }}
        transition={{ duration: enterMs / 1000, ease: CONTROLS_EASE, width: sizing, height: sizing }}
        className={`${CONTROLS_CLASSES.spotChip} ${side === 'left' ? 'right-0' : 'left-0'}`}
      >
        <div ref={inner} className={CONTROLS_CLASSES.spotChipInner} style={{ width: editing ? width - 2 * edge : 'max-content' }}>
          <SpotChipHead system={system} editing={editing} />
          {editing && <QuickEdit system={system} maxHeight={maxHeight} onFolded={onFolded} />}
        </div>
      </motion.div>
    </motion.div>
  )
}
