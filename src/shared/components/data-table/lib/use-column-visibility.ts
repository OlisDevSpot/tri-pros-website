'use client'

import type { ColumnDef, VisibilityState } from '@tanstack/react-table'

import { useCallback, useMemo } from 'react'

import { useTablePreferences } from '@/shared/components/data-table/contexts/table-preferences-context'
import { getColumnId } from '@/shared/components/data-table/lib/get-column-id'

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
  /** Columns the viewer hid (excludes `meta.hidden`, locked and hidden-by-default columns). */
  hiddenCount: number
}

interface ColumnMetaShape {
  displayName?: string
  locked?: boolean
  hidden?: boolean
  defaultHidden?: boolean
}

const NO_OVERRIDES: Record<string, boolean> = {}

export function useColumnVisibility<TData>(
  tableId: string,
  columns: readonly ColumnDef<TData>[],
): UseColumnVisibilityResult {
  const [preferences, updatePreferences] = useTablePreferences(tableId)
  const overrides = preferences.visibility ?? NO_OVERRIDES
  const setOverrides = useCallback((apply: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    updatePreferences(prev => ({ ...prev, visibility: apply(prev.visibility ?? NO_OVERRIDES) }))
  }, [updatePreferences])

  const defaultVisibleById = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const col of columns) {
      const id = getColumnId(col)
      if (id) {
        map.set(id, !(col.meta as ColumnMetaShape | undefined)?.defaultHidden)
      }
    }
    return map
  }, [columns])

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
      v[id] = id in overrides ? overrides[id] : (defaultVisibleById.get(id) ?? true)
    }
    return v
  }, [columns, overrides, defaultVisibleById])

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
        visible: id in overrides ? overrides[id] : (defaultVisibleById.get(id) ?? true),
      })
    }
    return list
  }, [columns, overrides, defaultVisibleById])

  // Counts only what the viewer hid; a hidden-by-default column isn't "hidden by you".
  const hiddenCount = useMemo(
    () => toggleableColumns.reduce((n, c) => (overrides[c.id] === false && !c.locked ? n + 1 : n), 0),
    [toggleableColumns, overrides],
  )

  const setColumnVisible = useCallback((id: string, visible: boolean) => {
    setOverrides((prev) => {
      // Storing only departures from the column's default keeps the saved preferences free of stale entries.
      if (visible === (defaultVisibleById.get(id) ?? true)) {
        if (!(id in prev)) {
          return prev
        }
        const { [id]: _drop, ...rest } = prev
        return rest
      }
      if (prev[id] === visible) {
        return prev
      }
      return { ...prev, [id]: visible }
    })
  }, [defaultVisibleById, setOverrides])

  const resetVisibility = useCallback(() => {
    setOverrides(prev => (Object.keys(prev).length === 0 ? prev : {}))
  }, [setOverrides])

  return { columnVisibility, setColumnVisible, resetVisibility, toggleableColumns, hiddenCount }
}
