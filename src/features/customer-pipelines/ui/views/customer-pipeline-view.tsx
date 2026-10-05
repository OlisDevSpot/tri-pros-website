'use client'

import type { CustomerPipelineItem } from '@/shared/entities/customers/types/pipeline-item'

import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CUSTOMER_PIPELINE_QUERY } from '@/features/customer-pipelines/constants/customer-pipeline-query'
import { groupCustomersByStage } from '@/features/customer-pipelines/lib/group-customers-by-stage'
import { CustomerKanbanCard } from '@/features/customer-pipelines/ui/components/customer-kanban-card'
import { CustomerPipelineMetricsBar } from '@/features/customer-pipelines/ui/components/customer-pipeline-metrics-bar'
import { PipelineSelect } from '@/features/customer-pipelines/ui/components/pipeline-select'
import { useKanbanStageFilter } from '@/shared/components/kanban/hooks/use-kanban-stage-filter'
import { KanbanBoard } from '@/shared/components/kanban/ui/kanban-board'
import { KanbanStageFilter } from '@/shared/components/kanban/ui/kanban-stage-filter'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { EmptyState } from '@/shared/components/states/empty-state'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { pipelineConfigs } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { usePipeline } from '@/shared/domains/pipelines/hooks/pipeline-context'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useIsHydrating } from '@/shared/hooks/use-is-hydrating'
import { openModal } from '@/shared/lib/open-modal'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

const FRESH_COLLAPSED_STAGES = ['declined']
const NO_COLLAPSED_STAGES: string[] = []

function getItemValue(item: CustomerPipelineItem): number | null {
  return item.totalPipelineValue > 0 ? item.totalPipelineValue : null
}

export function CustomerPipelineView() {
  const { pipeline, setPipeline } = usePipeline()
  const [createMeetingForCustomer, setCreateMeetingForCustomer] = useState<{ id: string, name: string } | null>(null)
  const [assignRepTarget, setAssignRepTarget] = useState<{ meetingIds: string[] } | null>(null)
  const trpc = useTRPC()
  const ability = useAbility()
  const isHydrating = useIsHydrating()
  const canManagePipeline = ability.can('manage', 'CustomerPipeline')

  const config = pipelineConfigs[pipeline]

  const stageFilterConfig = pipeline === 'fresh'
    ? { defaultVisible: [...config.stages].filter(s => s !== 'declined') }
    : { defaultVisible: [...config.stages] }

  const stageFilter = useKanbanStageFilter(config.stageConfig, stageFilterConfig)

  const query = useDataViewQuery(trpc.customerPipelinesRouter.getCustomerPipelineItems, { pipeline }, CUSTOMER_PIPELINE_QUERY)
  const items = query.rows

  const moveMutation = useMutation(
    trpc.customerPipelinesRouter.moveCustomerPipelineItem.mutationOptions({
      onError: () => {
        toast.error('Failed to move customer. Please try again.')
        void query.refresh()
      },
      onSettled: () => {
        void query.refresh()
      },
    }),
  )

  function handleMoveItem(itemId: string, fromStage: string, toStage: string) {
    // Intercept: any leads stage → meeting_scheduled opens meeting modal
    // Stage only updates AFTER meeting is successfully created (not on drag)
    if (pipeline === 'leads' && toStage === 'meeting_scheduled') {
      const item = items.find(i => i.id === itemId)
      if (item) {
        setCreateMeetingForCustomer({ id: item.id, name: item.name })
      }
      return
    }

    moveMutation.mutate({
      customerId: itemId,
      fromStage,
      toStage,
      pipeline,
    })
  }

  function handleBlockedTransition(message: string) {
    toast.info(message)
  }

  const handleViewProfile = useCallback((customerId: string) => {
    openModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId },
    })
  }, [])

  const handleAssignRep = useCallback((meetingId: string, _currentRepId: string | null) => {
    setAssignRepTarget({ meetingIds: [meetingId] })
  }, [])

  // TODO: Wire up when deleteCustomer tRPC procedure is implemented
  // const handleDeleteCustomer = useCallback((customerId: string) => { ... }, [])

  const renderCard = useCallback(
    (item: CustomerPipelineItem, _href: string, isDragOverlay?: boolean) => (
      <CustomerKanbanCard
        item={item}
        isDragOverlay={isDragOverlay}
        onViewProfile={handleViewProfile}
        onCreateMeeting={setCreateMeetingForCustomer}
        onAssignRep={handleAssignRep}
      />
    ),
    [handleViewProfile, handleAssignRep],
  )

  const groupedItems = useMemo(() => groupCustomersByStage(items, config.stages), [items, config.stages])

  const isSwitching = query.isStale || query.isFetching

  return (
    <motion.div
      initial={isHydrating ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-(--gutter) overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between shrink-0">
        <CustomerPipelineMetricsBar items={items} pipeline={pipeline} isLoading={query.isPending || isSwitching} />
        <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end">
          {canManagePipeline && <PipelineSelect value={pipeline} onChange={setPipeline} />}
          <KanbanStageFilter
            stages={config.stageConfig}
            visibleStages={stageFilter.visibleStages}
            alwaysVisible={stageFilter.alwaysVisible}
            onToggleStage={stageFilter.handleToggleStage}
            onShowAll={stageFilter.handleShowAll}
            onHideAll={stageFilter.handleHideAll}
          />
        </div>
      </div>

      <QueryToolbar query={query} entityName="customers" className="shrink-0">
        <QueryToolbar.Standard searchPlaceholder="Search by name or email…" sort />
      </QueryToolbar>

      {/* A filter change dims only after a short delay (quick loads never flash); a background refetch after a drag dims at once. */}
      <div
        data-stale={query.isStale || undefined}
        className={cn(
          'flex-1 min-h-0 transition-opacity duration-200 data-[stale=true]:pointer-events-none data-[stale=true]:opacity-50 data-[stale=true]:delay-200',
          query.isFetching && !query.isStale && 'opacity-50 pointer-events-none',
        )}
      >
        {items.length === 0 && !query.isPending && !query.isStale
          ? (
              <div className="w-full h-full flex items-center justify-center">
                <EmptyState
                  title="No Customers"
                  description={query.filterSort.activeFilterCount > 0 || query.filterSort.search ? 'No customers match these filters' : 'Start by scheduling meetings with customers'}
                  className="bg-card"
                />
              </div>
            )
          : (
              <KanbanBoard<CustomerPipelineItem>
                stageConfig={stageFilter.filteredStageConfig}
                groupedItems={groupedItems}
                allowedTransitions={config.allowedTransitions}
                blockedMessages={config.blockedMessages}
                onMoveItem={handleMoveItem}
                onBlockedTransition={handleBlockedTransition}
                collapsedStages={pipeline === 'fresh' ? FRESH_COLLAPSED_STAGES : NO_COLLAPSED_STAGES}
                showColumnValues
                getItemValue={getItemValue}
                renderCard={renderCard}
                className="mobile-bleed-right"
              />
            )}
      </div>
      {createMeetingForCustomer && (
        <CreateMeetingModal
          isOpen={!!createMeetingForCustomer}
          onClose={() => setCreateMeetingForCustomer(null)}
          onSuccess={() => {
            if (pipeline === 'leads') {
              moveMutation.mutate({
                customerId: createMeetingForCustomer.id,
                fromStage: 'new',
                toStage: 'meeting_scheduled',
                pipeline: 'leads',
              })
            }
            void query.refresh()
          }}
          customerId={createMeetingForCustomer.id}
          customerName={createMeetingForCustomer.name}
        />
      )}
      {assignRepTarget && (
        <ManageParticipantsModal
          meetingIds={assignRepTarget.meetingIds}
          open={!!assignRepTarget}
          onOpenChange={open => !open && setAssignRepTarget(null)}
          onSuccess={() => void query.refresh()}
        />
      )}
    </motion.div>
  )
}
