'use client'

import type { HTMLMotionProps, Variants } from 'motion/react'
import type { RefObject } from 'react'
import { motion, stagger, useInView, useIsomorphicLayoutEffect } from 'motion/react'
import { useRef, useState } from 'react'
import { REVEAL_STAGGER_S } from '@/shared/components/presentation/motion'

type MarginValue = `${number}px` | `${number}%`

interface RevealGroupProps extends HTMLMotionProps<'div'> {
  /** The scroller the group lives in; the viewport when omitted. */
  root?: RefObject<Element | null>
  amount?: number | 'some' | 'all'
  margin?: `${MarginValue} ${MarginValue} ${MarginValue} ${MarginValue}`
}

const GROUP: Variants = { hidden: {}, visible: { transition: { delayChildren: stagger(REVEAL_STAGGER_S) } } }

// Visible unless armed: the server HTML, a failed script and reduced motion all show every item at rest. Only a group
// that starts below the fold is hidden, after mount, so nobody sees content disappear.
export function RevealGroup({ root, amount = 0.15, margin = '0px 0px -12% 0px', ...props }: RevealGroupProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { root, amount, margin, once: true })
  const [armed, setArmed] = useState(false)
  const checked = useRef(false)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (checked.current || !el) {
      return
    }
    checked.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const bottom = root?.current?.getBoundingClientRect().bottom ?? window.innerHeight
    if (el.getBoundingClientRect().top >= bottom) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- position is only measurable after layout
      setArmed(true)
    }
  }, [root])

  return <motion.div ref={ref} initial={false} animate={armed && !inView ? 'hidden' : 'visible'} variants={GROUP} {...props} />
}
