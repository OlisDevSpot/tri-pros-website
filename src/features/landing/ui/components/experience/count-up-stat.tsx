'use client'

import { animate, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { parseStat } from '@/features/landing/lib/experience-parse-stat'

interface CountUpStatProps {
  value: string
  className?: string
}

export function CountUpStat({ value, className }: CountUpStatProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })
  const parsed = parseStat(value)
  const [display, setDisplay] = useState(parsed.numeric == null ? value : `${parsed.prefix}0${parsed.suffix}`)

  useEffect(() => {
    if (!isInView || parsed.numeric == null) {
      return
    }
    const controls = animate(0, parsed.numeric, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      onUpdate: v => setDisplay(`${parsed.prefix}${Math.round(v)}${parsed.suffix}`),
    })
    return () => controls.stop()
  }, [isInView, parsed.numeric, parsed.prefix, parsed.suffix])

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}
