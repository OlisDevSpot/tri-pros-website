'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { portfolioTableFilters } from '@/features/showroom/constants/table-filter-config'
import { useProjectActions } from '@/features/showroom/hooks/use-project-actions'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { getColumns } from './columns'

type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number]

const columns = getColumns()
const defaultSort = [{ id: 'createdAt', desc: true }]

interface Props {
  data: ProjectRow[]
  onFilteredCountChange?: (count: number) => void
}

export function PortfolioProjectsTable({ data, onFilteredCountChange }: Props) {
  const { deleteProject } = useProjectActions()

  const meta = {
    onDelete: (id: string) => deleteProject.mutate({ id }),
    isDeleting: deleteProject.isPending,
  }

  return (
    <DataTable
      data={data}
      columns={columns}
      meta={meta}
      filterConfig={portfolioTableFilters}
      defaultSort={defaultSort}
      entityName="project"
      rowDataAttribute="data-project-row"
      onFilteredCountChange={onFilteredCountChange}
    />
  )
}
