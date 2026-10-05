'use client'

import { motion } from 'motion/react'

import { DASHBOARD_MAIN_CLASS } from '@/features/agent-dashboard/constants/dashboard-main'
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
        className={DASHBOARD_MAIN_CLASS}
      >
        {children}
      </motion.main>
    </div>
  )
}

export default DashboardTemplate
