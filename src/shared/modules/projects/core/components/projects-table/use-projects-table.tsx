'use client'

import type { RenderExpandedRow } from '@/shared/components/data-table/types/entity-expanded-row'
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import type { ProjectColumnKey, ProjectRow, ProjectTableMeta } from '@/shared/modules/projects/core/lib/columns-registry'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { useEntityTable } from '@/shared/components/data-table/lib/use-entity-table'
import { ROOTS } from '@/shared/config/roots'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { openModal } from '@/shared/lib/open-modal'
import { useProjectActionConfigs } from '@/shared/modules/projects/core/hooks/use-project-action-configs'
import { PROJECT_COLUMNS } from '@/shared/modules/projects/core/lib/columns-registry'
import { useTRPC } from '@/trpc/helpers'

export interface UseProjectsTableOptions {
  renderExpandedRow?: RenderExpandedRow<ProjectRow>
}

export function useProjectsTable(
  tableView: EntityTableView<ProjectColumnKey, typeof PROJECT_FIELDS>,
  { renderExpandedRow }: UseProjectsTableOptions = {},
) {
  const trpc = useTRPC()
  const router = useRouter()
  const query = useDataViewQuery(trpc.projectsRouter.crud.list, {}, tableView.query)

  const { actions, DeleteConfirmDialog } = useProjectActionConfigs<ProjectRow>()

  const meta = useMemo(() => ({
    onViewProfile: (customerId: string) => {
      openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
    },
  }) satisfies Omit<ProjectTableMeta, 'rowActions'>, [])

  // Without an expanded row, a row click opens the project.
  const openProject = useCallback((row: ProjectRow) => router.push(ROOTS.dashboard.projects.byId(row.id)), [router])

  const table = useEntityTable({
    tableView,
    registry: PROJECT_COLUMNS,
    query,
    actions,
    meta,
    renderExpandedRow,
    onRowClick: openProject,
    entityName: 'project',
    rowDataAttribute: 'data-project-row',
    // A project without a description renders one line and sits 2px shorter (the Created cell's two lines set it).
    skeletonRowClassName: 'h-[51.5px]',
  })

  return { ...table, dialogs: <DeleteConfirmDialog /> }
}
