'use client'

import type { ReactNode } from 'react'

import { motion } from 'motion/react'

/**
 * Outer motion wrapper for records-page routes. Sibling to `RecordsPageShell`
 * (which owns the inner Header/Toolbar/Table layout) — this only adds the
 * page-level entrance animation and the full-height flex container that
 * lets the shell's table area scroll.
 */
export function RecordsPageMotionShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
      {children}
    </motion.div>
  )
}
