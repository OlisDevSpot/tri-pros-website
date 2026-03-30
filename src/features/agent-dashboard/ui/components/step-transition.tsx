'use client'

import { motion } from 'motion/react'

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]
const EASE_IN: [number, number, number, number] = [0.55, 0.06, 0.68, 0.19]

const variants = {
  initial: {
    opacity: 0,
    y: 12,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.25,
      ease: EASE_OUT,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(2px)',
    transition: {
      duration: 0.15,
      ease: EASE_IN,
    },
  },
}

interface StepTransitionProps {
  children: React.ReactNode
}

export function StepTransition({ children }: StepTransitionProps) {
  return (
    <motion.div
      className="h-full"
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
