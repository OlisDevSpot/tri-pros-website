'use client'

import type { ReactNode } from 'react'

import type { PaginatedQueryResult } from '@/shared/dal/client/lib/types'

import { useCallback, useMemo, useRef, useState } from 'react'

import { useToolbarShortcuts } from '@/shared/components/query-toolbar/hooks/use-toolbar-shortcuts'
import { QueryToolbarProvider } from '@/shared/components/query-toolbar/lib/context'
import { ToolbarInternalProvider } from '@/shared/components/query-toolbar/lib/internal-context'
import { cn } from '@/shared/lib/utils'

interface RootProps {
  pagination: PaginatedQueryResult<unknown>
  /** Singular noun for the records this toolbar filters (e.g. "proposal"). */
  entityName?: string
  className?: string
  children: ReactNode
}

export function QueryToolbarRoot({ pagination, entityName = 'results', className, children }: RootProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const handleOpenFilter = useCallback(() => setFilterOpen(true), [])

  const { page, pageCount, setPage } = pagination
  const handlePrevPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1)
    }
  }, [page, setPage])
  const handleNextPage = useCallback(() => {
    if (page < pageCount) {
      setPage(page + 1)
    }
  }, [page, pageCount, setPage])

  useToolbarShortcuts({
    searchInputRef,
    onOpenFilter: handleOpenFilter,
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
  })

  const internal = useMemo(
    () => ({ entityName, searchInputRef, filterOpen, setFilterOpen }),
    [entityName, filterOpen],
  )

  return (
    <QueryToolbarProvider value={pagination}>
      <ToolbarInternalProvider value={internal}>
        <div className={cn('flex flex-col gap-2', className)}>
          {children}
        </div>
      </ToolbarInternalProvider>
    </QueryToolbarProvider>
  )
}
