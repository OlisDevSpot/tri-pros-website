'use client'

import { motion } from 'motion/react'

import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'

export function PastProposalsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4 overflow-hidden"
    >
      <div className="shrink-0">
        <h2 className="text-lg font-semibold">Proposals</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <PastProposalsTable />
      </div>
    </motion.div>
  )
}
