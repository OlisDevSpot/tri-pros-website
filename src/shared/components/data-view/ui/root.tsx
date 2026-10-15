'use client'

import type { ReactNode } from 'react'

import type { DataViewContextValue } from '@/shared/components/data-view/lib/context'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { DataViewWindowKind } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { use, useMemo } from 'react'

import { DataViewBoundaryContext, DataViewContext } from '@/shared/components/data-view/lib/context'

interface DataViewRootProps<TRow, F extends FieldList, T extends ToolbarFilterId<F>, K extends DataViewWindowKind> {
  query: DataViewQueryResult<TRow, F, T, K>
  /** Plural ("customers"), as the toolbar's live status reads it. */
  entityName: string
  children: ReactNode
}

export function DataViewRoot<TRow, F extends FieldList, T extends ToolbarFilterId<F>, K extends DataViewWindowKind>({ query, entityName, children }: DataViewRootProps<TRow, F, T, K>) {
  const hasBoundary = use(DataViewBoundaryContext)
  // The hook returns a new object every render, but each field is already stable, so the value is keyed on the fields.
  const { rows, total, isPending, isStale, isFetching, refresh, filterSort, window: viewWindow } = query
  const value = useMemo((): DataViewContextValue => ({
    query: { rows, total, isPending, isStale, isFetching, refresh, filterSort, window: viewWindow } as unknown as DataViewContextValue['query'],
    entityName,
  }), [rows, total, isPending, isStale, isFetching, refresh, filterSort, viewWindow, entityName])

  // Without a boundary, a failed read or a row that fails to render takes the whole app down instead of this view.
  // eslint-disable-next-line node/prefer-global/process
  if (!hasBoundary && process.env.NODE_ENV !== 'production') {
    throw new Error('<DataView> needs a <DataViewBoundary> above it')
  }

  return <DataViewContext value={value}>{children}</DataViewContext>
}
