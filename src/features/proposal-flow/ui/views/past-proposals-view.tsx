'use client'

import { motion } from 'motion/react'
import { useCallback, useState } from 'react'
import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useGetProposals } from '@/features/proposal-flow/dal/client/queries/use-get-proposals'

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
      className="w-full h-full flex flex-col gap-4"
    >
      <Card className="h-full w-full flex flex-col lg:p-6 border-0 lg:border bg-transparent lg:bg-card">
        <CardHeader className="shrink-0 px-0">
          <CardTitle>Proposals</CardTitle>
          <CardDescription>
            {filteredCount !== null && filteredCount !== proposals.data.length
              ? `${filteredCount} of ${proposals.data.length} proposal${proposals.data.length !== 1 ? 's' : ''}`
              : `${proposals.data.length} total proposal${proposals.data.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grow min-h-0 overflow-hidden px-0">
          <PastProposalsTable data={proposals.data} onFilteredCountChange={handleFilteredCountChange} />
        </CardContent>
      </Card>
    </motion.div>
  )
}
