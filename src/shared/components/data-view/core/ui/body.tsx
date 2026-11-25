'use client'

import type { ReactElement, ReactNode } from 'react'

import { isValidElement } from 'react'

import { useDataView } from '@/shared/components/data-view/core/lib/context'
import { DataViewEmpty } from '@/shared/components/data-view/core/ui/empty'
import { cn } from '@/shared/lib/utils'

interface DataViewBodyProps {
  /** `true` for the default copy, copy of its own, or a node. Without it the children always render (a calendar keeps its grid). */
  empty?: true | { title?: string, description?: string } | ReactElement
  className?: string
  children: ReactNode
}

export function DataViewBody({ empty, className, children }: DataViewBodyProps) {
  const { query } = useDataView()
  // A stale or pending empty result belongs to another key or to nothing yet; saying "no match" for it would be false.
  const showsEmpty = empty !== undefined && query.rows.length === 0 && !query.isPending && !query.isStale
  return (
    // Only rows of another key dim; a refresh of these rows stays at full strength and the toolbar's hairline says so.
    // No x clipping here: the bodies bleed to the screen edge through this cell.
    <div
      data-slot="data-view-body"
      data-stale={query.isStale || undefined}
      aria-busy={query.isStale || query.isFetching || undefined}
      className={cn('min-h-0 flex-1 transition-opacity duration-200 data-[stale=true]:opacity-60 data-[stale=true]:delay-200', className)}
    >
      {showsEmpty ? renderEmpty(empty) : children}
    </div>
  )
}

function renderEmpty(empty: NonNullable<DataViewBodyProps['empty']>) {
  if (empty === true) {
    return <DataViewEmpty />
  }
  if (isValidElement(empty)) {
    return empty
  }
  return <DataViewEmpty title={empty.title} description={empty.description} />
}
