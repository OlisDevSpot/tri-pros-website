'use client'

import type { TablePreferences } from '@/shared/components/data-table/schemas/table-preferences'

import { createContext, use, useCallback, useState } from 'react'

export type TablePreferencesUpdate = (prev: TablePreferences) => TablePreferences

export interface TablePreferencesStore {
  byTable: Readonly<Record<string, TablePreferences>>
  update: (tableId: string, update: TablePreferencesUpdate) => void
}

export const TablePreferencesContext = createContext<TablePreferencesStore | null>(null)

const NO_PREFERENCES: TablePreferences = {}

/**
 * A table's saved preferences and their updater. Every hook reading one `tableId` shares one value, and the server
 * rendered the table with it, so the first paint already has the viewer's widths. Without a `tableId` the choices
 * last only as long as the table.
 */
export function useTablePreferences(tableId: string | undefined): [TablePreferences, (update: TablePreferencesUpdate) => void] {
  const store = use(TablePreferencesContext)
  const [unsaved, setUnsaved] = useState<TablePreferences>(NO_PREFERENCES)
  const updateSaved = useCallback((update: TablePreferencesUpdate) => {
    if (tableId) {
      store?.update(tableId, update)
    }
  }, [store, tableId])

  if (!tableId) {
    return [unsaved, setUnsaved]
  }
  if (!store) {
    throw new Error('A DataTable with a tableId must render inside <TablePreferencesProvider>')
  }
  return [store.byTable[tableId] ?? NO_PREFERENCES, updateSaved]
}
