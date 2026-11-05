'use client'

import type { CSSProperties } from 'react'
import type { SceneVisibleArea, StageShape } from '@/features/trade-scenes/types'

import { motion, useReducedMotion } from 'motion/react'

import { SCENE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { BLUEPRINT_LINE_CLASS } from '@/features/trade-scenes/constants/scene-load'
import { sceneVisibleAreaFor } from '@/features/trade-scenes/lib/scene-visible-area-for'
import { BRAND_EASE } from '@/shared/constants/motion'

interface BlueprintPaperProps {
  area?: { left: number, right: number }
}

function inkAt(percent: number) {
  return `color-mix(in oklab, var(--blueprint-ink) ${percent}%, transparent)`
}

function gridLayer(percent: number, size: string) {
  return [
    `linear-gradient(to right, ${inkAt(percent)} 1px, transparent 1px)`,
    `linear-gradient(to bottom, ${inkAt(percent)} 1px, transparent 1px)`,
    size,
  ] as const
}

const [coarseX, coarseY, coarseSize] = gridLayer(11, '8cqw 8cqw')
const [fineX, fineY, fineSize] = gridLayer(4.5, '1.6cqw 1.6cqw')

const GRID_STYLE: CSSProperties = {
  backgroundImage: [coarseX, coarseY, fineX, fineY].join(', '),
  backgroundSize: [coarseSize, coarseSize, fineSize, fineSize].join(', '),
  backgroundPosition: '-1px -1px',
}

const SLIDE = { duration: 0.4, ease: BRAND_EASE } as const

function centreOf(area: Pick<SceneVisibleArea, 'left' | 'right'>) {
  return `calc((${area.left}px + 100% - ${area.right}px) / 2)`
}

// A page opens on the whole home and the stage's shape is a container query, so each shape's visible area is known before
// the stage is measured, and the measure finds the line already standing where it belongs.
function lineLefts(): CSSProperties {
  const centre = (shape: StageShape) => centreOf(sceneVisibleAreaFor({ shape, width: 1, height: 1, focusCardBottom: null }))
  return { '--line-left-wide': centre('landscape'), '--line-left-narrow': centre('narrow'), '--line-left-portrait': centre('portrait') } as CSSProperties
}

const LINE_LEFTS = lineLefts()

// A size container, so `cqw` is the stage's width and the line can ask the stage's shape before anything is measured.
export function BlueprintPaper({ area }: BlueprintPaperProps) {
  const reduced = useReducedMotion()

  return (
    <div
      data-blueprint-paper
      className="pointer-events-none absolute inset-0 bg-(--blueprint-paper)"
      style={{ containerType: 'size' }}
    >
      <div className="absolute inset-0" style={GRID_STYLE} />
      <div className="absolute inset-[1.6cqw] border" style={{ borderColor: inkAt(32) }} />
      <div className="absolute inset-[2.1cqw] border" style={{ borderColor: inkAt(14) }} />
      {/* Anchored at the visible area's centre rather than spanning it: a position slide moves the box's edge, so a box that
          also changed width would carry its centred content past the target and back. Only a fold or a sidebar slide while
          it shows slides it. */}
      <motion.div
        aria-hidden
        layout="position"
        layoutDependency={`${area?.left}:${area?.right}`}
        transition={reduced ? { duration: 0 } : SLIDE}
        className={`absolute ${BLUEPRINT_LINE_CLASS}`}
        style={{ ...LINE_LEFTS, left: area ? centreOf(area) : undefined }}
      >
        <div className="flex w-max -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.9em]">
          <span className="font-mono uppercase tracking-[0.18em] whitespace-nowrap text-(--blueprint-ink)">{SCENE_COPY.loading}</span>
          <div className="relative h-px w-[14cqw] overflow-hidden" style={{ backgroundColor: inkAt(25) }}>
            <div className="h-full w-1/3 bg-(--blueprint-ink) animate-toolbar-shimmer motion-reduce:animate-none" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
