'use client'

import type { ToolbarFilter } from '@/shared/components/query-toolbar/lib/to-toolbar-filters'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, FilterOption } from '@/shared/dal/lib/query/field-list'

import { createContext, use } from 'react'

export interface QueryToolbarContextValue {
  /** Widened once at the root, so every slot reads one non-generic shape. */
  query: DataViewQueryResult<unknown, FieldList, string>
  filters: readonly ToolbarFilter[]
  sortOptions: readonly FilterOption[]
}

const QueryToolbarContext = createContext<QueryToolbarContextValue | null>(null)

export const QueryToolbarProvider = QueryToolbarContext.Provider

export function useQueryToolbarContext(): QueryToolbarContextValue {
  const ctx = use(QueryToolbarContext)
  if (!ctx) {
    throw new Error('QueryToolbar slot used outside of <QueryToolbar> root')
  }
  return ctx
}
