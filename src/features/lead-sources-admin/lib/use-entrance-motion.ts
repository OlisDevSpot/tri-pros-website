'use client'

import { useReducedMotion } from 'motion/react'

const ENTRANCE_EASE = [0.22, 1, 0.36, 1] as const

export function useEntranceMotion() {
  const reduce = useReducedMotion()

  return function entrance(delay: number, distance: number = 8) {
    if (reduce) {
      return {}
    }
    return {
      initial: { opacity: 0, y: distance },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.24, delay, ease: ENTRANCE_EASE },
    }
  }
}
