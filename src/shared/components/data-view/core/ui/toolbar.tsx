'use client'

import type { ReactNode } from 'react'

import { useDataView } from '@/shared/components/data-view/core/lib/context'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'

export function DataViewToolbar({ className, children }: { className?: string, children: ReactNode }) {
  const { query, entityName } = useDataView()
  return (
    <QueryToolbar query={query} entityName={entityName} className={className}>
      {children}
    </QueryToolbar>
  )
}
