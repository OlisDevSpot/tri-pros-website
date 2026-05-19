'use client'

import type { ProjectRow, ProjectTableMeta } from '@/shared/entities/projects/lib/columns-registry'
import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useCallback, useMemo, useState } from 'react'
import { PROJECT_FILTER_CONFIG } from '@/features/project-management/constants/project-table-filter-config'
import { ProjectDetailSheet } from '@/features/project-management/ui/components/project-detail-sheet'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { useProjectActionConfigs } from '@/shared/entities/projects/hooks/use-project-action-configs'
import { useProjectActions } from '@/shared/entities/projects/hooks/use-project-actions'

import { PROJECT_COLUMNS } from '@/shared/entities/projects/lib/columns-registry'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useTRPC } from '@/trpc/helpers'

const SHOW_COLUMNS = ['title', 'city', 'isPublic', 'completedAt', 'createdAt'] as const

export function PortfolioProjectsTable() {
  const trpc = useTRPC()
  const router = useRouter()
  const { deleteProject } = useProjectActions()
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete project',
    message: 'This will permanently delete this project and all its media. This cannot be undone.',
  })

  const pagination = usePaginatedQuery<Record<string, never>, ProjectRow>(
    trpc.projectsRouter.crud.list.queryOptions,
    {},
    {
      paramPrefix: 'pj',
      pageSize: 20,
      pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
      filters: PROJECT_FILTER_CONFIG,
    },
  )

  const handleRowClick = useCallback((project: ProjectRow) => {
    setSelectedProject(project)
    setIsSheetOpen(true)
  }, [])

  const { actions: sharedActions, DeleteConfirmDialog: ActionDeleteDialog } = useProjectActionConfigs<ProjectRow>()

  const columns = useEntityColumns(PROJECT_COLUMNS, { show: SHOW_COLUMNS })
  const visibility = useColumnVisibility('projects', columns)

  const meta = useMemo<ProjectTableMeta>(() => ({
    projectActions: () => sharedActions,
  }), [sharedActions])

  return (
    <>
      <ActionDeleteDialog />
      <DeleteConfirmDialog />

      <RecordsPageShell
        header={(
          <RecordsPageHeader
            title="Projects"
            pagination={pagination}
            actions={(
              <Button size="sm" onClick={() => router.push(ROOTS.dashboard.projects.new())}>
                <PlusIcon className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )}
          />
        )}
        toolbar={(
          <QueryToolbar pagination={pagination} entityName="projects">
            <QueryToolbar.Standard searchPlaceholder="Search by title or city…" visibility={visibility} />
          </QueryToolbar>
        )}
        table={(
          <DataTable
            tableId="projects"
            data={pagination.rows}
            columns={columns}
            meta={meta}
            entityName="project"
            rowDataAttribute="data-project-row"
            onRowClick={handleRowClick}
            serverPagination={toDataTablePagination(pagination)}
            serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
            columnVisibility={visibility.columnVisibility}
          />
        )}
      />

      <ProjectDetailSheet
        project={selectedProject}
        isOpen={isSheetOpen}
        close={() => setIsSheetOpen(false)}
        onDelete={selectedProject
          ? async () => {
            const ok = await confirmDelete()
            if (ok) {
              deleteProject.mutate({ id: selectedProject.id })
            }
          }
          : undefined}
      />
    </>
  )
}
