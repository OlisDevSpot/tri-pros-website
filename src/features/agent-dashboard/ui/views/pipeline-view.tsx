'use client'

import type { MeetingPipelineStage, PipelineMode } from '@/features/agent-dashboard/constants/pipeline-stages'
import type { MeetingPipelineItem, PipelineItem, ProposalPipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  MEETING_ALLOWED_DRAG_TRANSITIONS,
  MEETING_BLOCKED_MESSAGES,
  meetingStageConfig,
  PROPOSAL_ALLOWED_DRAG_TRANSITIONS,
  PROPOSAL_BLOCKED_MESSAGES,
  proposalStageConfig,
} from '@/features/agent-dashboard/constants/pipeline-stages'
import { groupMeetingsByStage, groupProposalsByStage } from '@/features/agent-dashboard/lib/group-items-by-stage'
import { KanbanBoard } from '@/features/agent-dashboard/ui/components/kanban-board'
import { PipelineMetricsBar } from '@/features/agent-dashboard/ui/components/pipeline-metrics-bar'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useTRPC } from '@/trpc/helpers'

function getMeetingHref(item: PipelineItem): string {
  return `/dashboard/meetings/${item.id}`
}

function getProposalHref(item: PipelineItem): string {
  return `/dashboard?step=edit-proposal&proposalId=${item.id}`
}

export function PipelineView() {
  const [mode, setMode] = useState<PipelineMode>('meetings')
  const trpc = useTRPC()

  const meetingsQuery = useQuery(trpc.dashboardRouter.getMeetingPipelineItems.queryOptions())
  const proposalsQuery = useQuery(trpc.dashboardRouter.getProposalPipelineItems.queryOptions())
  const pipelineStats = useQuery(trpc.dashboardRouter.getPipelineStats.queryOptions())

  const moveMeetingMutation = useMutation(
    trpc.dashboardRouter.moveMeetingPipelineItem.mutationOptions({
      onMutate: async () => {
        await meetingsQuery.refetch()
      },
      onError: () => {
        toast.error('Failed to move meeting. Please try again.')
        meetingsQuery.refetch()
      },
      onSettled: () => {
        meetingsQuery.refetch()
        pipelineStats.refetch()
      },
    }),
  )

  function handleMoveMeeting(meetingId: string, fromStage: string, toStage: string) {
    moveMeetingMutation.mutate({
      meetingId,
      fromStage: fromStage as MeetingPipelineStage,
      toStage: toStage as MeetingPipelineStage,
    })
  }

  function handleBlockedTransition(message: string) {
    toast.info(message)
  }

  const activeQuery = mode === 'meetings' ? meetingsQuery : proposalsQuery

  if (activeQuery.isLoading) {
    return (
      <LoadingState
        title="Loading Pipeline"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!activeQuery.data) {
    return (
      <ErrorState
        title="Error: Could not load pipeline"
        description="Please try again"
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
      <div className="flex items-center gap-4 justify-between">
        <Tabs value={mode} onValueChange={v => setMode(v as PipelineMode)}>
          <TabsList>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="proposals">Proposals</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'proposals' && pipelineStats.data && (
          <PipelineMetricsBar metrics={pipelineStats.data.metrics} />
        )}
      </div>

      <div className="flex-1 min-h-0">
        {activeQuery.data.length === 0
          ? (
              <div className="w-full h-full flex items-center justify-center">
                <EmptyState
                  title={mode === 'meetings' ? 'No Meetings' : 'No Proposals'}
                  description={mode === 'meetings' ? 'Start by setting meetings' : 'Create proposals from completed meetings'}
                  className="bg-card"
                />
              </div>
            )
          : mode === 'meetings'
            ? (
                <KanbanBoard
                  stageConfig={meetingStageConfig}
                  groupedItems={groupMeetingsByStage(activeQuery.data as MeetingPipelineItem[])}
                  allowedTransitions={MEETING_ALLOWED_DRAG_TRANSITIONS}
                  blockedMessages={MEETING_BLOCKED_MESSAGES}
                  onMoveItem={handleMoveMeeting}
                  onBlockedTransition={handleBlockedTransition}
                  getItemHref={getMeetingHref}
                />
              )
            : (
                <KanbanBoard
                  stageConfig={proposalStageConfig}
                  groupedItems={groupProposalsByStage(activeQuery.data as ProposalPipelineItem[])}
                  allowedTransitions={PROPOSAL_ALLOWED_DRAG_TRANSITIONS}
                  blockedMessages={PROPOSAL_BLOCKED_MESSAGES}
                  onBlockedTransition={handleBlockedTransition}
                  collapsedStages={['declined']}
                  getItemHref={getProposalHref}
                  showColumnValues
                />
              )}
      </div>
    </motion.div>
  )
}
