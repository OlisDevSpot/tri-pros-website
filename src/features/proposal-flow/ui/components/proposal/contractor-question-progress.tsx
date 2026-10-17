'use client'

import type { RefObject } from 'react'
import { motion, useScroll, useSpring } from 'motion/react'

interface Props {
  root: RefObject<HTMLElement | null>
  target: RefObject<HTMLElement | null>
}

// Mount only once the scroller exists: useScroll throws in dev on a container ref that is still empty.
export function ContractorQuestionProgress({ root, target }: Props) {
  const { scrollYProgress } = useScroll({ container: root, target, offset: ['start start', 'end end'] })
  const scaleX = useSpring(scrollYProgress, { stiffness: 300, damping: 40, skipInitialAnimation: true })
  return <motion.i className="block h-full origin-left bg-primary" style={{ scaleX }} />
}
