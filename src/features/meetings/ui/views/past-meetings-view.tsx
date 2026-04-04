'use client'

import type { PipelineScope } from '@/shared/pipelines/ui/pipeline-scope-toggle'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useMemo } from 'react'
import { PastMeetingsTable } from '@/features/meetings/ui/components/table'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'
import { getStoredPipeline } from '@/shared/pipelines/hooks/pipeline-context'
import { deriveMeetingPipeline } from '@/shared/pipelines/lib/derive-meeting-pipeline'
import { PipelineScopeToggle } from '@/shared/pipelines/ui/pipeline-scope-toggle'
import { useTRPC } from '@/trpc/helpers'

export function PastMeetingsView() {
  const trpc = useTRPC()
  const meetings = useQuery(trpc.meetingsRouter.getAll.queryOptions())
  const [filteredCount, setFilteredCount] = usePersistedState<number | null>('tri-pros:meetings-filtered-count', null)
  const handleFilteredCountChange = useCallback((count: number) => setFilteredCount(count), [setFilteredCount])
  const activePipeline = getStoredPipeline()
  const [scope, setScope] = usePersistedState<PipelineScope>('tri-pros:meetings-scope', 'all')

  const scopedData = useMemo(() => {
    if (!meetings.data || scope === 'all') {
      return meetings.data
    }
    return meetings.data.filter((m) => {
      const derived = deriveMeetingPipeline({ projectId: m.projectId, pipeline: m.pipeline as 'fresh' | 'rehash' | 'dead' })
      return derived === scope
    })
  }, [meetings.data, scope])

  if (meetings.isLoading) {
    return (
      <LoadingState
        title="Loading Past Meetings"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!scopedData) {
    return (
      <ErrorState
        title="Error: Could not load past meetings"
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
        className="w-full h-full flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <div />
          <PipelineScopeToggle value={scope} onChange={setScope} activePipeline={activePipeline} />
        </div>
        <EmptyState
          title="No Meetings"
          description="No meetings in this pipeline. Switch to 'All' to see everything."
          className="bg-card"
        />
      </motion.div>
    )
  }

  if (scopedData.length === 0) {
    return (
      <EmptyState
        title="No Meetings Found"
        description="Create a new meeting to get started"
        className="bg-card"
      />
    )
  }

  const totalCount = meetings.data?.length ?? 0

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
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Past Meetings</CardTitle>
              <CardDescription>
                {filteredCount !== null && filteredCount !== scopedData.length
                  ? `${filteredCount} of ${scopedData.length} meeting${scopedData.length !== 1 ? 's' : ''}`
                  : scope !== 'all'
                    ? `${scopedData.length} of ${totalCount} meeting${totalCount !== 1 ? 's' : ''}`
                    : `${totalCount} total meeting${totalCount !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <PipelineScopeToggle value={scope} onChange={setScope} activePipeline={activePipeline} />
          </div>
        </CardHeader>
        <CardContent className="grow min-h-0 overflow-hidden px-0">
          <PastMeetingsTable data={scopedData} onFilteredCountChange={handleFilteredCountChange} />
        </CardContent>
      </Card>
    </motion.div>
  )
}
