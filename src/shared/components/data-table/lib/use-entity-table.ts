'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { RenderExpandedRow } from '@/shared/components/data-table/types/entity-expanded-row'
import type { EntityTableMeta } from '@/shared/components/data-table/types/entity-table-meta'
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { useMemo } from 'react'

import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'

export interface UseEntityTableOptions<TRow extends { id: string }, TExtra extends object, F extends FieldList, T extends ToolbarFilterId<F>> {
  tableView: EntityTableView<string, F, T>
  registry: ColumnRegistry<TRow, any>
  query: DataViewQueryResult<TRow, F, T, 'page'>
  actions: EntityActionConfig<TRow>[]
  /** The entity's own meta entries, memoized by the caller; `rowActions` is added from `actions`. */
  meta: TExtra
  renderExpandedRow?: RenderExpandedRow<TRow>
  /** Ignored by `DataTable` while `renderExpandedRow` is set. */
  onRowClick?: (row: TRow) => void
  entityName: string
  rowDataAttribute: string
  skeletonRowClassName?: string
  getRowClassName?: (row: TRow) => string | undefined
}

/** The part of every entity table that isn't about the entity: columns, visibility, meta and the `DataTable` props. */
export function useEntityTable<TRow extends { id: string }, TExtra extends object, F extends FieldList, T extends ToolbarFilterId<F>>({
  tableView,
  registry,
  query,
  actions,
  meta: extra,
  renderExpandedRow,
  onRowClick,
  entityName,
  rowDataAttribute,
  skeletonRowClassName,
  getRowClassName,
}: UseEntityTableOptions<TRow, TExtra, F, T>) {
  const columns = useEntityColumns(registry, { show: tableView.columns })
  const visibility = useColumnVisibility(tableView.tableId, columns)

  const meta = useMemo(() => ({ ...extra, rowActions: actions }), [extra, actions])

  const expandedRowRenderer = useMemo(
    () => renderExpandedRow ? (row: TRow) => renderExpandedRow(row, { actions }) : undefined,
    [renderExpandedRow, actions],
  )

  const dataTableProps = {
    tableId: tableView.tableId,
    data: query.rows,
    columns,
    meta,
    entityName,
    rowDataAttribute,
    skeletonRowClassName,
    getRowClassName,
    renderExpandedRow: expandedRowRenderer,
    onRowClick,
    serverPagination: toDataTablePagination(query),
    serverSorting: toDataTableSorting(query),
    columnVisibility: visibility.columnVisibility,
  } satisfies DataTableProps<TRow, TExtra & EntityTableMeta<TRow>>

  return { query, visibility, dataTableProps }
}
