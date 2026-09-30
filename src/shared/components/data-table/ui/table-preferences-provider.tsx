'use client'

import type { TablePreferencesStore, TablePreferencesUpdate } from '@/shared/components/data-table/contexts/table-preferences-context'
import type { TablePreferences } from '@/shared/components/data-table/schemas/table-preferences'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { TablePreferencesContext } from '@/shared/components/data-table/contexts/table-preferences-context'
import { takeLegacyTablePreferences } from '@/shared/components/data-table/lib/take-legacy-table-preferences'
import { writeTablePreferencesCookie } from '@/shared/components/data-table/lib/write-table-preferences-cookie'
import { tablePreferencesSchema } from '@/shared/components/data-table/schemas/table-preferences'

/** An emptied map is the column defaults again, so it drops out rather than keep the cookie alive. */
function withoutEmptyMaps(preferences: TablePreferences): TablePreferences {
  return {
    sizes: preferences.sizes && Object.keys(preferences.sizes).length > 0 ? preferences.sizes : undefined,
    frozen: preferences.frozen,
    visibility: preferences.visibility && Object.keys(preferences.visibility).length > 0 ? preferences.visibility : undefined,
  }
}

/** Holds every table's preferences for the dashboard, seeded from the request's cookies, and writes changes back. */
export function TablePreferencesProvider({ initial, children }: { initial: Record<string, TablePreferences>, children: React.ReactNode }) {
  const [byTable, setByTable] = useState(initial)

  const latest = useRef(byTable)
  latest.current = byTable
  const written = useRef(initial)

  // A column drag changes widths every frame; the cookie takes the settled value, and `pagehide` catches a reload
  // or tab close inside the debounce window.
  const flush = useCallback(() => {
    for (const [tableId, preferences] of Object.entries(latest.current)) {
      if (written.current[tableId] !== preferences) {
        writeTablePreferencesCookie(tableId, preferences)
      }
    }
    written.current = latest.current
  }, [])

  useEffect(() => {
    const timer = setTimeout(flush, 300)
    return () => clearTimeout(timer)
  }, [byTable, flush])

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  useEffect(() => {
    const legacy = takeLegacyTablePreferences()
    const tableIds = Object.keys(legacy)
    if (tableIds.length === 0) {
      return
    }
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- localStorage is readable only after mount
    setByTable((prev) => {
      const next = { ...prev }
      for (const tableId of tableIds) {
        const parsed = tablePreferencesSchema.safeParse(legacy[tableId])
        if (parsed.success) {
          // A cookie already written on this device is newer than what localStorage held.
          next[tableId] = withoutEmptyMaps({ ...parsed.data, ...prev[tableId] })
        }
      }
      return next
    })
  }, [])

  const update = useCallback((tableId: string, apply: TablePreferencesUpdate) => {
    setByTable(prev => ({ ...prev, [tableId]: withoutEmptyMaps(apply(prev[tableId] ?? {})) }))
  }, [])

  const store = useMemo((): TablePreferencesStore => ({ byTable, update }), [byTable, update])

  return <TablePreferencesContext value={store}>{children}</TablePreferencesContext>
}
