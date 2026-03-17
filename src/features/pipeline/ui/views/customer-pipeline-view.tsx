'use client'

import type { CustomerPipelineStage } from '@/features/pipeline/constants/customer-pipeline-stages'
import type { CustomerPipelineItem } from '@/features/pipeline/types'
import type { DataViewType } from '@/shared/components/data-view-type-toggle'

import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import {
  CUSTOMER_ALLOWED_DRAG_TRANSITIONS,
  CUSTOMER_BLOCKED_MESSAGES,
  customerPipelineStages,
  customerStageConfig,
} from '@/features/pipeline/constants/customer-pipeline-stages'
import { groupCustomersByStage } from '@/features/pipeline/lib/group-customers-by-stage'
import { CustomerKanbanCard } from '@/features/pipeline/ui/components/customer-kanban-card'
import { CustomerPipelineMetricsBar } from '@/features/pipeline/ui/components/customer-pipeline-metrics-bar'
import { CustomerPipelineTable } from '@/features/pipeline/ui/components/customer-pipeline-table'
import { CustomerProfileModal } from '@/features/pipeline/ui/components/customer-profile-modal'
import { DataViewTypeToggle } from '@/shared/components/data-view-type-toggle'
import { KanbanBoard } from '@/shared/components/kanban/ui/kanban-board'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { ROOTS } from '@/shared/config/roots'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

export function CustomerPipelineView() {
  const [layout, setLayout] = useState<DataViewType>('kanban')
  const trpc = useTRPC()
  const { open: openModal, setModal } = useModalStore()

  const pipelineQuery = useQuery(
    trpc.pipelineRouter.getCustomerPipelineItems.queryOptions(),
  )

  const moveMutation = useMutation(
    trpc.pipelineRouter.moveCustomerPipelineItem.mutationOptions({
      onError: () => {
        toast.error('Failed to move customer. Please try again.')
        pipelineQuery.refetch()
      },
      onSettled: () => {
        pipelineQuery.refetch()
      },
    }),
  )

  function handleMoveItem(itemId: string, fromStage: string, toStage: string) {
    moveMutation.mutate({
      customerId: itemId,
      fromStage: fromStage as CustomerPipelineStage,
      toStage: toStage as CustomerPipelineStage,
    })
  }

  function handleBlockedTransition(message: string) {
    toast.info(message)
  }

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

  const renderCard = useCallback(
    (item: CustomerPipelineItem, _href: string, isDragOverlay?: boolean) => (
      <CustomerKanbanCard
        item={item}
        isDragOverlay={isDragOverlay}
        onViewProfile={handleViewProfile}
      />
    ),
    [handleViewProfile],
  )

  if (pipelineQuery.isLoading) {
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
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <CustomerPipelineMetricsBar items={pipelineQuery.data} />
        <DataViewTypeToggle value={layout} onChange={setLayout} />
      </div>

      <div className="flex-1 min-h-0">
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
                  stageConfig={customerStageConfig}
                  groupedItems={groupCustomersByStage(pipelineQuery.data)}
                  allowedTransitions={CUSTOMER_ALLOWED_DRAG_TRANSITIONS}
                  blockedMessages={CUSTOMER_BLOCKED_MESSAGES}
                  onMoveItem={handleMoveItem}
                  onBlockedTransition={handleBlockedTransition}
                  collapsedStages={['declined']}
                  columnFilter={{
                    defaultVisible: [...customerPipelineStages].filter(s => s !== 'declined'),
                  }}
                  getItemHref={getItemHref}
                  showColumnValues
                  getItemValue={getItemValue}
                  renderCard={renderCard}
                />
              )}
      </div>
    </motion.div>
  )
}
