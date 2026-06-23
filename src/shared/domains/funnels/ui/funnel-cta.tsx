'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  CTA_HOVER,
  CTA_PRESS_SPRING,
  CTA_SHEEN_TRANSITION,
  CTA_TAP,
} from '@/shared/domains/funnels/constants/funnel-motion'
import { cn } from '@/shared/lib/utils'

/**
 * The funnel's primary call-to-action — the single most important affordance on
 * the landing, pulling visitors to the next step.
 *
 * Visual = promoted study winner #3: a deepened brand-blue gradient fill
 * (`--cta-from`→`--cta-to`) so white text clears AA+ (≈6.5:1). Identity comes
 * from a faint brand hairline (`--cta-ring`), NOT a glow halo — deliberately
 * understated so it sits cleanly on the dark hero island and the light blocks
 * alike. All colors are design tokens (see globals.css), never ad-hoc.
 *
 * Motion = restrained: a tactile spring on hover/press, plus a single occasional
 * sheen sweep as the only ambient motion — no glow, no pulsing. The sheen is
 * gated on `useReducedMotion()`; when reduced, nothing loops and the static
 * hairline carries the brand (matters for the senior/low-vision audience).
 * Transform/opacity only → compositor-friendly. Motion config is shared from
 * `../constants/funnel-motion`.
 *
 * Layout is caller-owned: pass width/margin/alignment via `className` (e.g.
 * `w-full @xs:w-auto` in the hero, `self-center` between blocks). `children`
 * carry the label + icon so each placement controls its own direction (↓ from
 * the hero, ↑ from below).
 */
export function FunnelCta({ children, onClick, className }: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        'relative inline-flex min-h-13 cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-linear-to-b from-(--cta-from) to-(--cta-to) px-7 text-base font-semibold text-white shadow-(--cta-ring) outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        className,
      )}
      whileHover={reduce ? undefined : CTA_HOVER}
      whileTap={CTA_TAP}
      transition={CTA_PRESS_SPRING}
    >
      {!reduce
        ? (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: '-200%' }}
              animate={{ x: '500%' }}
              transition={CTA_SHEEN_TRANSITION}
            />
          )
        : null}
      <span className="relative inline-flex items-center gap-2.5">{children}</span>
    </motion.button>
  )
}
