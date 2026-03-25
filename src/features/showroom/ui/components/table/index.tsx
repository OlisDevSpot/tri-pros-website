'use client'

import type { ProjectRow } from './columns'
import type { DataTableFilterConfig, DataTableMultiSelectFilter } from '@/shared/components/data-table/types'

import { useMemo } from 'react'
import { portfolioTableFilters } from '@/features/showroom/constants/table-filter-config'
import { useProjectActions } from '@/features/showroom/hooks/use-project-actions'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { getColumns } from './columns'

const defaultSort = [{ id: 'createdAt', desc: true }]

interface Props {
  data: ProjectRow[]
  tradeFilter?: DataTableMultiSelectFilter
  onFilteredCountChange?: (count: number) => void
  onRowClick?: (row: ProjectRow) => void
}

export function PortfolioProjectsTable({ data, tradeFilter, onFilteredCountChange, onRowClick }: Props) {
  const { deleteProject } = useProjectActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete project',
    message: 'This will permanently delete this project and all its media. This cannot be undone.',
  })

  const meta = {
    onDelete: async (id: string) => {
      const ok = await confirmDelete()
      if (ok) {
        deleteProject.mutate({ id })
      }
    },
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
    <>
      <DeleteConfirmDialog />
      <DataTable
        data={data}
        columns={columns}
        meta={meta}
        filterConfig={filterConfig}
        defaultSort={defaultSort}
        entityName="project"
        rowDataAttribute="data-project-row"
        onFilteredCountChange={onFilteredCountChange}
        onRowClick={onRowClick}
      />
    </>
  )
}
