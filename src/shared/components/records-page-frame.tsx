'use client'

import type { ReactNode } from 'react'

import { motion } from 'motion/react'

import { useIsHydrating } from '@/shared/hooks/use-is-hydrating'

/**
 * Outer motion wrapper for records-page routes. Sibling to `RecordsPageShell`
 * (which owns the inner Header/Toolbar/Table layout) — this only adds the
 * page-level fade and the full-height flex container that lets the shell's
 * table area scroll.
 */
export function RecordsPageMotionShell({ children }: { children: ReactNode }) {
  const isHydrating = useIsHydrating()
  return (
    <motion.div
      initial={isHydrating ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
      {children}
    </motion.div>
  )
}
