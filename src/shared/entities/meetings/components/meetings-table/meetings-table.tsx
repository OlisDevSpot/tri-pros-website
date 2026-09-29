'use client'

import type { ReactNode } from 'react'

import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { MeetingsTableQuery, UseMeetingsTableOptions } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'
import type { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import type { MeetingColumnKey } from '@/shared/entities/meetings/lib/columns-registry'

import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { useMeetingsTable } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'

interface MeetingsTableProps extends UseMeetingsTableOptions {
  tableView: EntityTableView<MeetingColumnKey, typeof MEETING_FIELDS>
  header: (query: MeetingsTableQuery) => ReactNode
}

export function MeetingsTable({ tableView, header, renderExpandedRow }: MeetingsTableProps) {
  const { query, visibility, dataTableProps, dialogs } = useMeetingsTable(tableView, { renderExpandedRow })

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
