'use client'

import { motion } from 'motion/react'

import { useIsHydrating } from '@/shared/hooks/use-is-hydrating'

export function DashboardTemplate({ children }: { children: React.ReactNode }) {
  // The fade softens a soft navigation's swap. On a document load the page arrives as server
  // HTML, and fading it would keep that HTML invisible until the JS hydrates.
  const isHydrating = useIsHydrating()
  return (
    <div className="flex h-full min-w-0 flex-col">
      <motion.main
        initial={isHydrating ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6 has-data-stage:p-0"
      >
        {children}
      </motion.main>
    </div>
  )
}

export default DashboardTemplate
