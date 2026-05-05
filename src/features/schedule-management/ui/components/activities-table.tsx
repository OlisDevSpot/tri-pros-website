'use client'

import type { ActivityRow } from '@/features/schedule-management/constants/activity-table-columns'

import { useMemo } from 'react'

import { ACTIVITY_FILTER_CONFIG, ACTIVITY_PAGE_SIZE_OPTIONS } from '@/features/schedule-management/constants/activity-filter-config'
import { getActivityColumns } from '@/features/schedule-management/constants/activity-table-columns'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { usePaginatedQuery } from '@/shared/dal/client/query/use-paginated-query'
import { useTRPC } from '@/trpc/helpers'

export function ActivitiesTable() {
  const trpc = useTRPC()
  const columns = useMemo(() => getActivityColumns(), [])

  const pagination = usePaginatedQuery<Record<string, never>, ActivityRow>(
    trpc.scheduleRouter.activities.list.queryOptions,
    {},
    {
      paramPrefix: 'act',
      pageSize: 20,
      pageSizeOptions: ACTIVITY_PAGE_SIZE_OPTIONS,
      filters: ACTIVITY_FILTER_CONFIG,
    },
  )

  return (
    <RecordsPageShell
      header={<RecordsPageHeader title="Activities" pagination={pagination} />}
      toolbar={(
        <QueryToolbar pagination={pagination} entityName="activities">
          <QueryToolbar.Bar>
            <QueryToolbar.Search placeholder="Search by title or description…" />
            <QueryToolbar.FilterTrigger />
            <QueryToolbar.PageSize />
          </QueryToolbar.Bar>
          <QueryToolbar.ChipRail />
          <QueryToolbar.LiveStatus />
        </QueryToolbar>
      )}
      table={(
        <DataTable
          tableId="activities"
          data={pagination.rows}
          columns={columns}
          entityName="activity"
          serverPagination={toDataTablePagination(pagination)}
          serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
        />
      )}
    />
  )
}
