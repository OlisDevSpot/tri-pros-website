'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { DataTableFilterConfig, DataTableMultiSelectFilter } from '@/shared/components/data-table/types'
import type { AppRouter } from '@/trpc/routers/app'

import { useMemo } from 'react'
import { portfolioTableFilters } from '@/features/showroom/constants/table-filter-config'
import { useProjectActions } from '@/features/showroom/hooks/use-project-actions'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { getColumns } from './columns'

type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & {
  tradeNames: string[]
}

const defaultSort = [{ id: 'createdAt', desc: true }]

interface Props {
  data: ProjectRow[]
  tradeFilter?: DataTableMultiSelectFilter
  onFilteredCountChange?: (count: number) => void
}

export function PortfolioProjectsTable({ data, tradeFilter, onFilteredCountChange }: Props) {
  const { deleteProject } = useProjectActions()

  const meta = {
    onDelete: (id: string) => deleteProject.mutate({ id }),
    isDeleting: deleteProject.isPending,
  }

  const columns = useMemo(() => getColumns(), [])

  const filterConfig = useMemo<DataTableFilterConfig[]>(() => {
    if (!tradeFilter) {
      return portfolioTableFilters
    }
    return [...portfolioTableFilters, tradeFilter]
  }, [tradeFilter])

  return (
    <DataTable
      data={data}
      columns={columns}
      meta={meta}
      filterConfig={filterConfig}
      defaultSort={defaultSort}
      entityName="project"
      rowDataAttribute="data-project-row"
      onFilteredCountChange={onFilteredCountChange}
    />
  )
}
