'use client'

import type { ReactNode } from 'react'

import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList } from '@/shared/dal/lib/query/field-list'
import type { UseMeetingsTableOptions } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'
import type { MeetingColumnKey, MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { fromPaginatedQuery } from '@/shared/dal/client/lib/from-paginated-query'
import { useMeetingsTable } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'

interface MeetingsTableProps extends UseMeetingsTableOptions {
  tableView: EntityTableView<MeetingColumnKey>
  header: (query: DataViewQueryResult<MeetingRow, FieldList, string, 'page'>) => ReactNode
}

export function MeetingsTable({ tableView, header, renderExpandedRow }: MeetingsTableProps) {
  const { pagination, visibility, dataTableProps, dialogs } = useMeetingsTable(tableView, { renderExpandedRow })
  const query = fromPaginatedQuery(pagination)

  return (
    <>
      {dialogs}
      <RecordsPageShell
        header={header(query)}
        toolbar={(
          <QueryToolbar query={query} entityName="meetings">
            <QueryToolbar.Standard searchPlaceholder="Search by customer or type…" visibility={visibility} />
          </QueryToolbar>
        )}
        table={<DataTable {...dataTableProps} />}
      />
    </>
  )
}
