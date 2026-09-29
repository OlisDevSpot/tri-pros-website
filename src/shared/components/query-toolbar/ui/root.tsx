'use client'

import type { ReactNode } from 'react'

import type { QueryToolbarContextValue } from '@/shared/components/query-toolbar/lib/context'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { useCallback, useMemo, useRef, useState } from 'react'

import { useToolbarShortcuts } from '@/shared/components/query-toolbar/hooks/use-toolbar-shortcuts'
import { QueryToolbarProvider } from '@/shared/components/query-toolbar/lib/context'
import { ToolbarInternalProvider } from '@/shared/components/query-toolbar/lib/internal-context'
import { toSortOptions, toToolbarFilters } from '@/shared/components/query-toolbar/lib/to-toolbar-filters'
import { cn } from '@/shared/lib/utils'

interface RootProps<F extends FieldList, T extends ToolbarFilterId<F>> {
  query: DataViewQueryResult<unknown, F, T>
  /** Singular noun for the records this toolbar filters (e.g. "proposal"). */
  entityName?: string
  className?: string
  children: ReactNode
}

export function QueryToolbarRoot<F extends FieldList, T extends ToolbarFilterId<F>>({ query, entityName = 'results', className, children }: RootProps<F, T>) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const handleOpenFilter = useCallback(() => setFilterOpen(true), [])

  const pageWindow = query.window.kind === 'page' ? query.window : undefined
  const handlePrevPage = useCallback(() => {
    if (pageWindow && pageWindow.page > 1) {
      pageWindow.setPage(pageWindow.page - 1)
    }
  }, [pageWindow])
  const handleNextPage = useCallback(() => {
    if (pageWindow && pageWindow.page < pageWindow.pageCount) {
      pageWindow.setPage(pageWindow.page + 1)
    }
  }, [pageWindow])

  useToolbarShortcuts({
    searchInputRef,
    onOpenFilter: handleOpenFilter,
    onPrevPage: pageWindow ? handlePrevPage : undefined,
    onNextPage: pageWindow ? handleNextPage : undefined,
  })

  const { fields, toolbar, options } = query.filterSort
  const filters = useMemo(() => toToolbarFilters(fields, toolbar, options), [fields, toolbar, options])
  const sortOptions = useMemo(() => toSortOptions(fields), [fields])
  const value = useMemo<QueryToolbarContextValue>(() => ({
    query: query as unknown as QueryToolbarContextValue['query'],
    filters,
    sortOptions,
  }), [query, filters, sortOptions])

  const internal = useMemo(
    () => ({ entityName, searchInputRef, filterOpen, setFilterOpen }),
    [entityName, filterOpen],
  )

  return (
    <QueryToolbarProvider value={value}>
      <ToolbarInternalProvider value={internal}>
        <div className={cn('flex flex-col gap-2', className)}>
          {children}
        </div>
      </ToolbarInternalProvider>
    </QueryToolbarProvider>
  )
}
