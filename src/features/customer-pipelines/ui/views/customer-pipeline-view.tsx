'use client'

import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { DataViewType } from '@/shared/components/data-view-type-toggle'
import type { CustomerPipeline } from '@/shared/types/enums'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { pipelineConfigs } from '@/features/customer-pipelines/constants/pipeline-config'
import { groupCustomersByStage } from '@/features/customer-pipelines/lib/group-customers-by-stage'
import { AssignRepDialog } from '@/features/customer-pipelines/ui/components/assign-rep-dialog'
import { CustomerKanbanCard } from '@/features/customer-pipelines/ui/components/customer-kanban-card'
import { CustomerPipelineMetricsBar } from '@/features/customer-pipelines/ui/components/customer-pipeline-metrics-bar'
import { CustomerPipelineTable } from '@/features/customer-pipelines/ui/components/customer-pipeline-table'
import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components/customer-profile-modal'
import { PipelineSelect } from '@/features/customer-pipelines/ui/components/pipeline-select'
import { CreateMeetingModal } from '@/features/meetings/ui/components/create-meeting-modal'
import { DataViewTypeToggle } from '@/shared/components/data-view-type-toggle'
import { KanbanBoard } from '@/shared/components/kanban/ui/kanban-board'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { ROOTS } from '@/shared/config/roots'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { cn } from '@/shared/lib/utils'
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'

export function CustomerPipelineView() {
  const [layout, setLayout] = useState<DataViewType>('kanban')
  const [pipeline, setPipeline] = useState<CustomerPipeline>('active')
  const [createMeetingForCustomer, setCreateMeetingForCustomer] = useState<{ id: string, name: string } | null>(null)
  const [assignRepTarget, setAssignRepTarget] = useState<{ meetingIds: string[], currentRepId: string | null } | null>(null)
  const trpc = useTRPC()
  const { open: openModal, setModal } = useModalStore()
  const ability = useAbility()
  const canManagePipeline = ability.can('manage', 'CustomerPipeline')

  const config = pipelineConfigs[pipeline]

  const pipelineQuery = useQuery({
    ...trpc.customerPipelinesRouter.getCustomerPipelineItems.queryOptions({ pipeline }),
    placeholderData: keepPreviousData,
  })

  const moveMutation = useMutation(
    trpc.customerPipelinesRouter.moveCustomerPipelineItem.mutationOptions({
      onError: () => {
        toast.error('Failed to move customer. Please try again.')
        pipelineQuery.refetch()
      },
      onSettled: () => {
        pipelineQuery.refetch()
      },
    }),
  )

  const moveToPipelineMutation = useMutation(
    trpc.customerPipelinesRouter.moveCustomerToPipeline.mutationOptions({
      onSuccess: () => {
        toast.success('Customer moved to pipeline')
        pipelineQuery.refetch()
      },
      onError: () => {
        toast.error('Failed to move customer between pipelines')
      },
    }),
  )

  const handleMoveToPipeline = useCallback((customerId: string, targetPipeline: CustomerPipeline) => {
    moveToPipelineMutation.mutate({ customerId, pipeline: targetPipeline })
  }, [moveToPipelineMutation])

  function handleMoveItem(itemId: string, fromStage: string, toStage: string) {
    // Intercept: needs_confirmation → meeting_scheduled opens modal instead
    if (fromStage === 'needs_confirmation' && toStage === 'meeting_scheduled') {
      const item = pipelineQuery.data?.find(i => i.id === itemId)
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

  const handleCreateMeeting = useCallback((customerId: string) => {
    const item = pipelineQuery.data?.find(i => i.id === customerId)
    if (item) {
      setCreateMeetingForCustomer({ id: item.id, name: item.name })
    }
  }, [pipelineQuery.data])

  const handleViewProfile = useCallback((customerId: string) => {
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId },
    })
    openModal()
  }, [setModal, openModal])

  function getItemHref(item: CustomerPipelineItem): string {
    return `${ROOTS.dashboard.root}?customer=${item.id}`
  }

  function getItemValue(item: CustomerPipelineItem): number | null {
    return item.totalPipelineValue > 0 ? item.totalPipelineValue : null
  }

  const handleAssignRep = useCallback((meetingId: string, currentRepId: string | null) => {
    setAssignRepTarget({ meetingIds: [meetingId], currentRepId })
  }, [])

  // TODO: Wire up when deleteCustomer tRPC procedure is implemented
  // const handleDeleteCustomer = useCallback((customerId: string) => { ... }, [])

  const renderCard = useCallback(
    (item: CustomerPipelineItem, _href: string, isDragOverlay?: boolean) => (
      <CustomerKanbanCard
        item={item}
        currentPipeline={pipeline}
        isDragOverlay={isDragOverlay}
        canManagePipeline={canManagePipeline}
        onViewProfile={handleViewProfile}
        onMoveToPipeline={handleMoveToPipeline}
        onCreateMeeting={handleCreateMeeting}
        onAssignRep={handleAssignRep}
      />
    ),
    [handleViewProfile, handleMoveToPipeline, handleCreateMeeting, handleAssignRep, pipeline, canManagePipeline],
  )

  const filterPortalRef = useRef<HTMLDivElement>(null)
  const [filterPortalTarget, setFilterPortalTarget] = useState<HTMLElement | null>(null)

  const filterRefCallback = useCallback((node: HTMLDivElement | null) => {
    filterPortalRef.current = node
    setFilterPortalTarget(node)
  }, [])

  const isInitialLoad = pipelineQuery.isLoading && !pipelineQuery.data
  const isSwitching = pipelineQuery.isFetching && !pipelineQuery.isLoading

  if (isInitialLoad) {
    return (
      <LoadingState
        title="Loading Pipeline"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!pipelineQuery.data) {
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
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between shrink-0">
        <CustomerPipelineMetricsBar items={pipelineQuery.data} isLoading={isSwitching} />
        <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end">
          {canManagePipeline && <PipelineSelect value={pipeline} onChange={setPipeline} />}
          <div ref={filterRefCallback} />
          <DataViewTypeToggle value={layout} onChange={setLayout} />
        </div>
      </div>

      <div className={cn('flex-1 min-h-0 transition-opacity duration-200', isSwitching && 'opacity-50 pointer-events-none')}>
        {pipelineQuery.data.length === 0
          ? (
              <div className="w-full h-full flex items-center justify-center">
                <EmptyState
                  title="No Customers"
                  description="Start by scheduling meetings with customers"
                  className="bg-card"
                />
              </div>
            )
          : layout === 'table'
            ? (
                <div className="h-full overflow-y-auto">
                  <CustomerPipelineTable
                    data={pipelineQuery.data}
                    onRowClick={item => handleViewProfile(item.id)}
                    onViewProfile={handleViewProfile}
                  />
                </div>
              )
            : (
                <KanbanBoard<CustomerPipelineItem>
                  stageConfig={config.stageConfig}
                  groupedItems={groupCustomersByStage(pipelineQuery.data, config.stages)}
                  allowedTransitions={config.allowedTransitions}
                  blockedMessages={config.blockedMessages}
                  onMoveItem={handleMoveItem}
                  onBlockedTransition={handleBlockedTransition}
                  collapsedStages={pipeline === 'active' ? ['declined'] : []}
                  columnFilter={pipeline === 'active'
                    ? { defaultVisible: [...config.stages].filter(s => s !== 'declined') }
                    : { defaultVisible: [...config.stages] }}
                  filterPortalTarget={filterPortalTarget}
                  getItemHref={getItemHref}
                  showColumnValues
                  getItemValue={getItemValue}
                  renderCard={renderCard}
                />
              )}
      </div>
      {createMeetingForCustomer && (
        <CreateMeetingModal
          isOpen={!!createMeetingForCustomer}
          onClose={() => setCreateMeetingForCustomer(null)}
          onSuccess={() => pipelineQuery.refetch()}
          customerId={createMeetingForCustomer.id}
          customerName={createMeetingForCustomer.name}
        />
      )}
      {assignRepTarget && (
        <AssignRepDialog
          meetingIds={assignRepTarget.meetingIds}
          currentRepId={assignRepTarget.currentRepId}
          open={!!assignRepTarget}
          onOpenChange={open => !open && setAssignRepTarget(null)}
          onSuccess={() => pipelineQuery.refetch()}
        />
      )}
    </motion.div>
  )
}
