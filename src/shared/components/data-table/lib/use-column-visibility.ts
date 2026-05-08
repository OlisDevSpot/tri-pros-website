'use client'

import type { ColumnDef, VisibilityState } from '@tanstack/react-table'

import { useCallback, useEffect, useMemo, useState } from 'react'

const COL_VISIBILITY_KEY = 'dt-col-visibility'

export interface ToggleableColumn {
  id: string
  displayName: string
  locked: boolean
  visible: boolean
}

export interface UseColumnVisibilityResult {
  /** Merged map (static `meta.hidden` + user overrides) for TanStack Table. */
  columnVisibility: VisibilityState
  setColumnVisible: (id: string, visible: boolean) => void
  resetVisibility: () => void
  /** Columns that opted in via `meta.displayName`; drives the toggle UI. */
  toggleableColumns: ToggleableColumn[]
  /** User-hidden count (excludes `meta.hidden` and `locked` columns). */
  hiddenCount: number
}

interface ColumnMetaShape {
  displayName?: string
  locked?: boolean
  hidden?: boolean
}

function getColumnId<TData>(col: ColumnDef<TData>): string | undefined {
  if ('id' in col && typeof col.id === 'string') {
    return col.id
  }
  if ('accessorKey' in col && typeof col.accessorKey === 'string') {
    return col.accessorKey
  }
  return undefined
}

function loadOverrides(tableId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`${COL_VISIBILITY_KEY}:${tableId}`)
    return raw ? JSON.parse(raw) as Record<string, boolean> : {}
  }
  catch {
    return {}
  }
}

export function useColumnVisibility<TData>(
  tableId: string,
  columns: readonly ColumnDef<TData>[],
): UseColumnVisibilityResult {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => loadOverrides(tableId))

  // Persist (debounced). Empty map clears the key so localStorage stays
  // tidy when a user resets back to defaults.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (Object.keys(overrides).length === 0) {
          localStorage.removeItem(`${COL_VISIBILITY_KEY}:${tableId}`)
        }
        else {
          localStorage.setItem(`${COL_VISIBILITY_KEY}:${tableId}`, JSON.stringify(overrides))
        }
      }
      catch { /* localStorage unavailable */ }
    }, 200)
    return () => clearTimeout(timer)
  }, [tableId, overrides])

  const columnVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {}
    for (const col of columns) {
      const id = getColumnId(col)
      const meta = col.meta as ColumnMetaShape | undefined
      if (!id) {
        continue
      }
      if (meta?.hidden) {
        v[id] = false
        continue
      }
      if (id in overrides) {
        v[id] = overrides[id]
      }
    }
    return v
  }, [columns, overrides])

  const toggleableColumns = useMemo<ToggleableColumn[]>(() => {
    const list: ToggleableColumn[] = []
    for (const col of columns) {
      const id = getColumnId(col)
      const meta = col.meta as ColumnMetaShape | undefined
      if (!id || meta?.hidden || !meta?.displayName) {
        continue
      }
      list.push({
        id,
        displayName: meta.displayName,
        locked: meta.locked === true,
        visible: id in overrides ? overrides[id] : true,
      })
    }
    return list
  }, [columns, overrides])

  const hiddenCount = useMemo(
    () => toggleableColumns.reduce((n, c) => (!c.visible && !c.locked ? n + 1 : n), 0),
    [toggleableColumns],
  )

  const setColumnVisible = useCallback((id: string, visible: boolean) => {
    setOverrides((prev) => {
      // Default is visible. Toggling back to visible drops the override
      // entirely so we don't accumulate stale entries in localStorage.
      if (visible) {
        if (!(id in prev)) {
          return prev
        }
        const { [id]: _drop, ...rest } = prev
        return rest
      }
      if (prev[id] === false) {
        return prev
      }
      return { ...prev, [id]: false }
    })
  }, [])

  const resetVisibility = useCallback(() => {
    setOverrides(prev => (Object.keys(prev).length === 0 ? prev : {}))
  }, [])

  return { columnVisibility, setColumnVisible, resetVisibility, toggleableColumns, hiddenCount }
}
