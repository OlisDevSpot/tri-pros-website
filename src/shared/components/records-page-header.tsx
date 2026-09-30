'use client'

import type { ReactNode } from 'react'

import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { formatTotalCount } from '@/shared/lib/pagination-format'
import { cn } from '@/shared/lib/utils'

interface RecordsPageHeaderProps {
  /** Heading text — the entity name in plural form (e.g. "Proposals"). */
  title: string
  /** Any data-view result; the header reads only `total` and `isPending` for the count. */
  query: Pick<DataViewQueryResult<unknown, FieldList, string>, 'total' | 'isPending'>
  /** Heading level for semantics; visual size stays the same. Defaults to h2. */
  as?: 'h1' | 'h2' | 'h3'
  /** Right-aligned slot for page-level actions ("New", "Export", etc.). */
  actions?: ReactNode
  className?: string
}

/**
 * Standard header bar for a records page. Renders the title and the live
 * total-count badge baseline-aligned on a single row, with an optional
 * right-aligned actions slot.
 *
 * Sibling to `<QueryToolbar>` and `<DataTable>` — the three together form
 * the canonical records-page shape. Compose via `<RecordsPageShell>` for
 * consistent spacing and table fill behavior across entities.
 */
export function RecordsPageHeader({
  title,
  query,
  as = 'h2',
  actions,
  className,
}: RecordsPageHeaderProps) {
  const Tag = as
  const countText = query.isPending ? 'Loading…' : formatTotalCount(query.total)
  return (
    <header className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Tag className="text-lg font-semibold tracking-tight">
          {title}
        </Tag>
        <span className="text-xs text-muted-foreground tabular-nums">
          {countText}
        </span>
      </div>
      {actions && (
        <div className="ml-auto flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
