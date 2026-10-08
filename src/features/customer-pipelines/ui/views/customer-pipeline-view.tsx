'use client'

import type { CustomerPipelineItem } from '@/shared/entities/customers/types/pipeline-item'

import { useMutation } from '@tanstack/react-query'
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
import { PageBar } from '@/shared/components/page-bar'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { EmptyState } from '@/shared/components/states/empty-state'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { pipelineConfigs } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { usePipeline } from '@/shared/domains/pipelines/hooks/pipeline-context'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'
import { openModal } from '@/shared/lib/open-modal'
import { cn } from '@/shared/lib/utils'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { useTRPC } from '@/trpc/helpers'

const FRESH_COLLAPSED_STAGES = ['declined']
const NO_COLLAPSED_STAGES: string[] = []

function getItemValue(item: CustomerPipelineItem): number | null {
  return item.totalPipelineValue > 0 ? item.totalPipelineValue : null
}

export function CustomerPipelineView() {
  const { pipeline, setPipeline } = usePipeline()
  const [createMeetingForCustomer, setCreateMeetingForCustomer] = useState<{ id: string, name: string } | null>(null)
  const trpc = useTRPC()
  const ability = useAbility()
  const canManagePipeline = ability.can('manage', 'CustomerPipeline')

  const config = pipelineConfigs[pipeline]

  const stageFilterConfig = pipeline === 'fresh'
    ? { defaultVisible: [...config.stages].filter(s => s !== 'declined') }
    : { defaultVisible: [...config.stages] }

  const stageFilter = useKanbanStageFilter(config.stageConfig, stageFilterConfig)

  const query = useDataViewQuery(trpc.customerPipelinesRouter.getCustomerPipelineItems, { pipeline }, CUSTOMER_PIPELINE_QUERY)
  const items = query.rows

  // A refetch the viewer caused (a drag's move) dims the board until the rows land. A background refetch (the
  // server's prefetch adopted on navigation, a stale re-read on mount) does not: the rows on screen stay at full
  // opacity until the new ones replace them, as the records tables do.
  const [settlingMove, setSettlingMove] = useState(false)
  const moveMutation = useMutation(
    trpc.customerPipelinesRouter.moveCustomerPipelineItem.mutationOptions({
      onError: () => {
        toast.error('Failed to move customer. Please try again.')
      },
      onSettled: () => {
        setSettlingMove(true)
        void query.refresh().finally(() => setSettlingMove(false))
      },
    }),
  )
  const isMoving = moveMutation.isPending || settlingMove

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

  // TODO: Wire up when deleteCustomer tRPC procedure is implemented
  // const handleDeleteCustomer = useCallback((customerId: string) => { ... }, [])

  const renderCard = useCallback(
    (item: CustomerPipelineItem, _href: string, isDragOverlay?: boolean) => (
      <CustomerKanbanCard
        item={item}
        isDragOverlay={isDragOverlay}
        onViewProfile={handleViewProfile}
        onCreateMeeting={setCreateMeetingForCustomer}
      />
    ),
    [handleViewProfile],
  )

  const groupedItems = useMemo(() => groupCustomersByStage(items, config.stages), [items, config.stages])

  return (
    <MeetingActionsHost>
      <div className="w-full h-full flex flex-col gap-(--gutter) overflow-hidden">
        <PageBar className="shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
            <CustomerPipelineMetricsBar items={items} pipeline={pipeline} isLoading={query.isPending || query.isStale} />
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
          <QueryToolbar query={query} entityName="customers">
            <QueryToolbar.Standard searchPlaceholder="Search by name, email or phone…" sort />
          </QueryToolbar>
        </PageBar>

        {/* A filter change dims only after a short delay (quick loads never flash); a drag's refresh dims at once. */}
        <div
          data-stale={query.isStale || undefined}
          aria-busy={query.isFetching || undefined}
          className={cn(
            'flex-1 min-h-0 transition-opacity duration-200 data-[stale=true]:pointer-events-none data-[stale=true]:opacity-50 data-[stale=true]:delay-200',
            isMoving && 'opacity-50 pointer-events-none',
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
                  isPending={query.isPending}
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
      </div>
    </MeetingActionsHost>
  )
}
