'use client'

import type { ActivityRow } from '@/features/schedule-management/constants/activity-table-columns'

import { useMemo } from 'react'

import { ACTIVITY_FILTER_CONFIG, ACTIVITY_PAGE_SIZE_OPTIONS } from '@/features/schedule-management/constants/activity-filter-config'
import { getActivityColumns } from '@/features/schedule-management/constants/activity-table-columns'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {pagination.isLoading ? 'Loading…' : `${pagination.total.toLocaleString()} total`}
        </span>

        <QueryToolbar pagination={pagination}>
          <QueryToolbar.Search placeholder="Search by title or description…" />
          <QueryToolbar.Filters />
          <QueryToolbar.ClearAll />
          <div className="ml-auto">
            <QueryToolbar.PageSize />
          </div>
        </QueryToolbar>

        <QueryToolbar pagination={pagination}>
          <QueryToolbar.ActiveFilterChips />
        </QueryToolbar>
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          tableId="activities"
          data={pagination.rows}
          columns={columns}
          entityName="activity"
          serverPagination={toDataTablePagination(pagination)}
          serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
        />
      </div>
    </div>
  )
}
