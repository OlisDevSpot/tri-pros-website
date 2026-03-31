'use client'

import { motion } from 'motion/react'
import { useCallback, useState } from 'react'
import { useGetProposals } from '@/features/proposal-flow/dal/client/queries/use-get-proposals'
import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'

export function PastProposalsView() {
  const proposals = useGetProposals()
  const [filteredCount, setFilteredCount] = useState<number | null>(null)
  const handleFilteredCountChange = useCallback((count: number) => setFilteredCount(count), [])

  if (proposals.isLoading) {
    return (
      <LoadingState
        title="Loading Past Proposals"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!proposals.data) {
    return (
      <ErrorState
        title="Error: Could not load past proposals"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (proposals.data.length === 0) {
    return (
      <ErrorState
        title="No Proposals Found"
        description="Create a new proposal"
        className="bg-card"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4 overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Proposals</h2>
          <p className="text-sm text-muted-foreground">
            {filteredCount !== null && filteredCount !== proposals.data.length
              ? `${filteredCount} of ${proposals.data.length} proposal${proposals.data.length !== 1 ? 's' : ''}`
              : `${proposals.data.length} total proposal${proposals.data.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <PastProposalsTable data={proposals.data} onFilteredCountChange={handleFilteredCountChange} />
      </div>
    </motion.div>
  )
}
