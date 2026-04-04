'use client'

import type { PipelineScope } from '@/shared/pipelines/ui/pipeline-scope-toggle'

import { motion } from 'motion/react'
import { useCallback, useMemo } from 'react'
import { useGetProposals } from '@/features/proposal-flow/dal/client/queries/use-get-proposals'
import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'
import { getStoredPipeline } from '@/shared/pipelines/hooks/pipeline-context'
import { deriveMeetingPipeline } from '@/shared/pipelines/lib/derive-meeting-pipeline'
import { PipelineScopeToggle } from '@/shared/pipelines/ui/pipeline-scope-toggle'

export function PastProposalsView() {
  const proposals = useGetProposals()
  const [filteredCount, setFilteredCount] = usePersistedState<number | null>('tri-pros:proposals-filtered-count', null)
  const handleFilteredCountChange = useCallback((count: number) => setFilteredCount(count), [setFilteredCount])
  const activePipeline = getStoredPipeline()
  const [scope, setScope] = usePersistedState<PipelineScope>('tri-pros:proposals-scope', 'all')

  const scopedData = useMemo(() => {
    if (!proposals.data || scope === 'all') {
      return proposals.data
    }
    return proposals.data.filter((p) => {
      if (!p.meetingPipeline) {
        return scope === 'fresh'
      }
      const derived = deriveMeetingPipeline({ projectId: p.meetingProjectId, pipeline: p.meetingPipeline as 'fresh' | 'rehash' | 'dead' })
      return derived === scope
    })
  }, [proposals.data, scope])

  if (proposals.isLoading) {
    return (
      <LoadingState
        title="Loading Past Proposals"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!scopedData) {
    return (
      <ErrorState
        title="Error: Could not load past proposals"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (scopedData.length === 0 && scope !== 'all') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ delay: 0.25, duration: 0.25 }}
        className="w-full h-full flex flex-col gap-4 overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <div />
          <PipelineScopeToggle value={scope} onChange={setScope} activePipeline={activePipeline} />
        </div>
        <EmptyState
          title="No Proposals"
          description="No proposals in this pipeline. Switch to 'All' to see everything."
          className="bg-card"
        />
      </motion.div>
    )
  }

  if (scopedData.length === 0) {
    return (
      <EmptyState
        title="No Proposals Found"
        description="Create a new proposal"
        className="bg-card"
      />
    )
  }

  const totalCount = proposals.data?.length ?? 0

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
            {filteredCount !== null && filteredCount !== scopedData.length
              ? `${filteredCount} of ${scopedData.length} proposal${scopedData.length !== 1 ? 's' : ''}`
              : scope !== 'all'
                ? `${scopedData.length} of ${totalCount} proposal${totalCount !== 1 ? 's' : ''}`
                : `${totalCount} total proposal${totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <PipelineScopeToggle value={scope} onChange={setScope} activePipeline={activePipeline} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <PastProposalsTable data={scopedData} onFilteredCountChange={handleFilteredCountChange} />
      </div>
    </motion.div>
  )
}
