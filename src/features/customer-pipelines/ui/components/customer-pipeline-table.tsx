'use client'

import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

import { useMemo } from 'react'

import { getPipelineColumns } from '@/features/customer-pipelines/constants/customer-pipeline-table-columns'
import { pipelineTableFilters } from '@/features/customer-pipelines/constants/customer-pipeline-table-filters'
import { DataTable } from '@/shared/components/data-table/ui/data-table'

interface Props {
  data: CustomerPipelineItem[]
  onRowClick?: (item: CustomerPipelineItem) => void
  onViewProfile?: (customerId: string) => void
}

export function CustomerPipelineTable({ data, onRowClick, onViewProfile }: Props) {
  const columns = useMemo(() => getPipelineColumns(), [])

  const meta = useMemo(() => ({
    onViewProfile: onViewProfile ?? (() => {}),
  }), [onViewProfile])

  return (
    <DataTable
      tableId="customer-pipelines"
      columns={columns}
      data={data}
      meta={meta}
      filterConfig={pipelineTableFilters}
      entityName="customer"
      onRowClick={onRowClick}
    />
  )
}
