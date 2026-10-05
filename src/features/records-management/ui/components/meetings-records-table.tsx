'use client'

import type { UseMeetingsTableOptions } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'

import { MEETINGS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/meetings-records-table-view'
import { EntityRecordsTable } from '@/shared/components/entity-records-table'
import { useMeetingsTable } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'

export function MeetingsRecordsTable({ renderExpandedRow }: UseMeetingsTableOptions) {
  const table = useMeetingsTable(MEETINGS_RECORDS_TABLE_VIEW, { renderExpandedRow })
  return <EntityRecordsTable title="Meetings" entityName="meetings" searchPlaceholder="Search by customer or type…" table={table} />
}
