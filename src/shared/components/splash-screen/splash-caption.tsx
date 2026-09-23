'use client'

import { motion } from 'motion/react'
import { SPLASH_CAPTION_DELAY_S, SPLASH_CAPTION_DURATION_S } from '@/shared/components/splash-screen/splash-timing'

interface SplashCaptionProps {
  /** Referenced by the press button's `aria-describedby`. */
  id: string
  title: string
  subheading?: string
  /** Play the entrance; `false` renders at rest (reduced motion). */
  animate: boolean
  ease: [number, number, number, number]
}

/**
 * The title and subheading, rising once the brand mark has landed (E3); the press cue, a
 * button, follows it in `SplashScreen`. Sized in `vw`, not `cqw`: the splash is fixed with no
 * container above it, where `cqw` would silently fall back to small-viewport units (review F11).
 */
export function SplashCaption({ id, title, subheading, animate, ease }: SplashCaptionProps) {
  return (
    <motion.span
      animate={{ opacity: 1, y: 0 }}
      className="grid max-w-[44ch] justify-items-center gap-2.5 text-center text-white"
      id={id}
      initial={animate ? { opacity: 0, y: 12 } : false}
      transition={{ duration: SPLASH_CAPTION_DURATION_S, delay: SPLASH_CAPTION_DELAY_S, ease }}
    >
      <span className="max-w-[22ch] font-sans text-[clamp(1.375rem,3.4vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-balance">
        {title}
      </span>
      {subheading && <span className="text-[clamp(0.9375rem,1.5vw,1.25rem)] leading-normal text-white/70">{subheading}</span>}
    </motion.span>
  )
}
