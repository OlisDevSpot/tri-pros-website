'use client'

import type { CustomerPipelineItem } from '@/features/pipeline/types'

import { useMemo } from 'react'

import { getPipelineColumns } from '@/features/pipeline/constants/pipeline-table-columns'
import { pipelineTableFilters } from '@/features/pipeline/constants/pipeline-table-filters'
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
      columns={columns}
      data={data}
      meta={meta}
      filterConfig={pipelineTableFilters}
      entityName="customer"
      onRowClick={onRowClick}
    />
  )
}
