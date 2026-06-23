'use client'

import type { CSSProperties } from 'react'
import type { DecorShape } from '@/shared/components/decor/constants/decor-config'
import { motion, useReducedMotion } from 'motion/react'
import {
  DECOR_DRAW_DURATION,
  DECOR_DRAW_STAGGER,
  DECOR_ORIGIN,
  DECOR_VIEWBOX,
} from '@/shared/components/decor/constants/decor-config'
import { buildDecorGeometry } from '@/shared/components/decor/lib/build-decor-geometry'
import { cn } from '@/shared/lib/utils'

/**
 * Brand-blue "atmosphere" layer — always anchored top-right, clipped by the
 * parent's overflow. One DNA (thin strokes + gradient band + falloff), varied
 * by `shape`. The parent MUST set `overflow-hidden` + `isolate`; content sits
 * on a higher z-index. Motion (draw-in) via motion/react; sweep/breathe via the
 * .decor-sweep/.decor-breathe CSS classes. Reduced motion → static final state.
 */
export function Decor({ shape = 'arc', rings, placement = 'corner', className }: { shape?: DecorShape, rings?: number, placement?: 'corner' | 'cover', className?: string }) {
  const reduce = useReducedMotion()
  const geometry = buildDecorGeometry(shape, rings)
  const { x, y } = DECOR_ORIGIN
  const isCover = placement === 'cover'

  return (
    <div
      className={cn(
        'pointer-events-none absolute',
        isCover
          ? 'inset-0 z-10 h-full w-full'
          : '-top-[150px] -right-[150px] z-0 h-[500px] w-[500px]',
        className,
      )}
      style={isCover ? ({ '--decor-gradient-alpha': '0.5' } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${DECOR_VIEWBOX} ${DECOR_VIEWBOX}`}
        preserveAspectRatio={isCover ? 'xMaxYMin slice' : 'xMidYMid meet'}
        fill="none"
      >
        <defs>
          <radialGradient id="decor-grad" cx={x} cy={y} r={420} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--decor-stroke)" stopOpacity="var(--decor-gradient-alpha)" />
            <stop offset="34%" stopColor="var(--decor-stroke)" stopOpacity="0.12" />
            <stop offset="66%" stopColor="var(--decor-stroke)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--decor-stroke)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle className="decor-breathe" cx={x} cy={y} r={420} fill="url(#decor-grad)" />

        <g className="decor-sweep" stroke="var(--decor-stroke)" fill="none" strokeLinecap="round">
          {geometry.map((ring, i) => {
            const common = {
              strokeWidth: ring.strokeWidth,
              initial: reduce ? false : { pathLength: 0, opacity: 0 },
              animate: { pathLength: 1, opacity: ring.opacity },
              transition: { duration: DECOR_DRAW_DURATION, delay: reduce ? 0 : i * DECOR_DRAW_STAGGER, ease: [0.32, 0.72, 0, 1] as const },
            }
            if (ring.kind === 'rect') {
              return <motion.rect key={i} x={ring.x} y={ring.y} width={ring.size} height={ring.size} {...common} />
            }
            if (ring.kind === 'path') {
              return <motion.path key={i} d={ring.d} {...common} />
            }
            return <motion.circle key={i} cx={ring.cx} cy={ring.cy} r={ring.r} {...common} />
          })}

          {shape === 'arc'
            ? (
                <g strokeWidth={1.6} opacity={0.55}>
                  <line x1={x} y1={y} x2={x - 108} y2={y} />
                  <line x1={x} y1={y} x2={x - 84} y2={y + 68} />
                  <line x1={x} y1={y} x2={x - 36} y2={y + 106} />
                  <line x1={150} y1={44} x2={150} y2={150} />
                  <line x1={144} y1={50} x2={156} y2={50} />
                  <line x1={144} y1={144} x2={156} y2={144} />
                </g>
              )
            : null}
        </g>

        <circle cx={x} cy={y} r={7} fill="var(--decor-stroke)" />
      </svg>
    </div>
  )
}
