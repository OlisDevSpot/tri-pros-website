'use client'

import { motion } from 'motion/react'

export function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <motion.main
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6"
      >
        {children}
      </motion.main>
    </div>
  )
}

export default DashboardTemplate
