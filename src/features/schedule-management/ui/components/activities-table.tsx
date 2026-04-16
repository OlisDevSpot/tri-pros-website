'use client'

import type { ActivityRow } from '@/features/schedule-management/constants/activity-table-columns'

import { useMemo } from 'react'

import { activityTableFilters } from '@/features/schedule-management/constants/activity-filter-config'
import { ACTIVITY_DEFAULT_SORT, getActivityColumns } from '@/features/schedule-management/constants/activity-table-columns'
import { DataTable } from '@/shared/components/data-table/ui/data-table'

interface ActivitiesTableProps {
  data: ActivityRow[]
  onFilteredDataChange?: (data: ActivityRow[]) => void
}

export function ActivitiesTable({ data, onFilteredDataChange }: ActivitiesTableProps) {
  const columns = useMemo(() => getActivityColumns(), [])

  return (
    <DataTable
      tableId="activities"
      data={data}
      columns={columns}
      filterConfig={activityTableFilters}
      defaultSort={ACTIVITY_DEFAULT_SORT}
      entityName="activity"
      onFilteredDataChange={onFilteredDataChange}
    />
  )
}
