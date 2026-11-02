// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'

import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'

interface CountedDollarsProps {
  value: number
}

// A figure counts to its new value on the scene's own timing, so the dollars fall as the ribbons narrow. The text is written
// from the motion value, never through React state, so a count re-renders nothing.
export function CountedDollars({ value }: CountedDollarsProps) {
  const reduceMotion = useReducedMotion()
  const count = useMotionValue(value)
  const text = useTransform(count, latest => formatMoney(latest))

  useEffect(() => {
    if (reduceMotion) {
      count.jump(value)
      return
    }
    const controls = animate(count, value, SCENE_MOTION.transition)
    return () => controls.stop()
  }, [count, value, reduceMotion])

  return <motion.span className="tabular-nums">{text}</motion.span>
}
