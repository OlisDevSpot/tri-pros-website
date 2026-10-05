'use client'

import { motion } from 'motion/react'
import { HOUSE_PATHS, R_PATH } from '@/shared/components/splash-screen/splash-paths'
import {
  SPLASH_HOUSE_DELAY_S,
  SPLASH_HOUSE_DURATION_S,
  SPLASH_HOUSE_STAGGER_S,
  SPLASH_MARK_DELAY_S,
  SPLASH_MARK_DURATION_S,
} from '@/shared/components/splash-screen/splash-timing'

interface SplashMarkProps {
  /** Play the entrance; `false` renders the finished mark at rest (reduced motion, E7). */
  animate: boolean
  /** The house paths' rise. */
  ease: [number, number, number, number]
}

/** The brand mark: the white house paths rise one after another, then the blue R springs in last. */
export function SplashMark({ animate, ease }: SplashMarkProps) {
  return (
    <svg
      className="h-auto w-48 sm:w-56"
      fill="none"
      height="463"
      viewBox="0 0 589 463"
      width="589"
    >
      {HOUSE_PATHS.map((d, i) => (
        <motion.path
          key={d.slice(0, 20)}
          animate={{ opacity: 1, y: 0 }}
          d={d}
          fill="white"
          initial={animate ? { opacity: 0, y: 12 } : false}
          transition={{
            duration: SPLASH_HOUSE_DURATION_S,
            delay: SPLASH_HOUSE_DELAY_S + i * SPLASH_HOUSE_STAGGER_S,
            ease,
          }}
        />
      ))}
      <motion.path
        animate={{ opacity: 1, scale: 1 }}
        d={R_PATH}
        fill="#03AFED"
        initial={animate ? { opacity: 0, scale: 0.8 } : false}
        transition={{
          duration: SPLASH_MARK_DURATION_S,
          delay: SPLASH_MARK_DELAY_S,
          type: 'spring',
          bounce: 0.3,
        }}
      />
    </svg>
  )
}
