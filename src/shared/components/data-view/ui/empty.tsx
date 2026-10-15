'use client'

import type { ReactNode } from 'react'

import { useDataView } from '@/shared/components/data-view/lib/context'
import { EmptyState } from '@/shared/components/states/empty-state'

interface DataViewEmptyProps {
  title?: string
  description?: string
  children?: ReactNode
}

export function DataViewEmpty({ title, description, children }: DataViewEmptyProps) {
  const { query, entityName } = useDataView()
  const isFiltered = query.filterSort.activeFilterCount > 0 || query.filterSort.search !== ''
  return (
    <EmptyState title={title ?? `No ${entityName}`} description={isFiltered ? `No ${entityName} match these filters` : description}>
      {children}
    </EmptyState>
  )
}
