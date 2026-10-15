'use client'

import type { ReactNode } from 'react'

import type { EntityTableResult } from '@/shared/components/data-table/types/entity-table-result'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { DataView } from '@/shared/components/data-view/data-view'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'

interface EntityRecordsTableProps<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  title: string
  /** Plural, for the toolbar's counts ("projects"). */
  entityName: string
  searchPlaceholder: string
  headerActions?: ReactNode
  /** An entity table hook's result, passed whole. */
  table: EntityTableResult<TRow, TMeta, F, T>
}

/** One records page: the header with its count, the standard toolbar and the table. */
export function EntityRecordsTable<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>>({
  title,
  entityName,
  searchPlaceholder,
  headerActions,
  table,
}: EntityRecordsTableProps<TRow, TMeta, F, T>) {
  return (
    <DataView query={table.query} entityName={entityName}>
      {table.dialogs}
      <div className="flex h-full min-h-0 flex-col gap-(--gutter)">
        <DataView.Bar>
          {/* The row is always one button tall, so a page with actions sits at the same height as one without. */}
          <header className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <DataView.Title className="text-lg font-semibold tracking-tight">{title}</DataView.Title>
              <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
            </div>
            {headerActions && <div className="ml-auto flex items-center gap-2">{headerActions}</div>}
          </header>
          <DataView.Toolbar>
            <QueryToolbar.Standard searchPlaceholder={searchPlaceholder} visibility={table.visibility} />
          </DataView.Toolbar>
        </DataView.Bar>
        <DataView.Body empty>
          <DataTable {...table.dataTableProps} />
        </DataView.Body>
      </div>
    </DataView>
  )
}
