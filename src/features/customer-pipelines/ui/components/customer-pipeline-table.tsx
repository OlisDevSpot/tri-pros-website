'use client'

import type { PipelineTableMeta } from '@/features/customer-pipelines/constants/customer-pipeline-table-columns'
import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

import { useCallback, useMemo } from 'react'

import { getPipelineColumns } from '@/features/customer-pipelines/constants/customer-pipeline-table-columns'
import { pipelineTableFilters } from '@/features/customer-pipelines/constants/customer-pipeline-table-filters'
import { useCustomerActionConfigs } from '@/features/customer-pipelines/hooks/use-customer-action-configs'
import { DataTable } from '@/shared/components/data-table/ui/data-table'

interface Props {
  data: CustomerPipelineItem[]
  onRowClick?: (item: CustomerPipelineItem) => void
  onViewProfile?: (customerId: string) => void
}

export function CustomerPipelineTable({ data, onRowClick, onViewProfile }: Props) {
  const columns = useMemo(() => getPipelineColumns(), [])

  const handleView = useCallback((entity: CustomerPipelineItem) => {
    onViewProfile?.(entity.id)
  }, [onViewProfile])

  const { actions: sharedActions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerPipelineItem>({
    onView: handleView,
  })

  const meta: PipelineTableMeta = useMemo(() => ({
    customerActions: () => sharedActions,
  }), [sharedActions])

  return (
    <>
      <DeleteConfirmDialog />
      <DataTable
        tableId="customer-pipelines"
        columns={columns}
        data={data}
        meta={meta}
        filterConfig={pipelineTableFilters}
        entityName="customer"
        onRowClick={onRowClick}
      />
    </>
  )
}
