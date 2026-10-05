'use client'

import type { ReactNode } from 'react'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'

export interface EntityRecordsTableSource<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  query: DataViewQueryResult<TRow, F, T>
  visibility: UseColumnVisibilityResult
  dataTableProps: DataTableProps<TRow, TMeta>
  dialogs: ReactNode
}

interface EntityRecordsTableProps<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  title: string
  /** Plural, for the toolbar's counts ("projects"). */
  entityName: string
  searchPlaceholder: string
  headerActions?: ReactNode
  /** An entity table hook's result, passed whole. */
  table: EntityRecordsTableSource<TRow, TMeta, F, T>
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
    <>
      {table.dialogs}
      <RecordsPageShell
        header={<RecordsPageHeader title={title} query={table.query} actions={headerActions} />}
        toolbar={(
          <QueryToolbar query={table.query} entityName={entityName}>
            <QueryToolbar.Standard searchPlaceholder={searchPlaceholder} visibility={table.visibility} />
          </QueryToolbar>
        )}
        table={<DataTable {...table.dataTableProps} />}
      />
    </>
  )
}
