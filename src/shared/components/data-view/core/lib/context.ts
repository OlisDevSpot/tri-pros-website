'use client'

import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { createContext, use } from 'react'

export interface DataViewContextValue {
  /** Widened once at the root, so every part reads one non-generic shape. */
  query: DataViewQueryResult<unknown, FieldList, string>
  /** Plural ("customers"): the toolbar's live status and the empty copy read it. */
  entityName: string
}

export const DataViewContext = createContext<DataViewContextValue | null>(null)

export function useDataView(): DataViewContextValue {
  const ctx = use(DataViewContext)
  if (!ctx) {
    throw new Error('DataView part used outside of <DataView> root')
  }
  return ctx
}

/** Set by `DataViewBoundary`, so a root can tell it has one above it. */
export const DataViewBoundaryContext = createContext(false)
