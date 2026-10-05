'use client'

import type { EntityExpandedRowContext } from '@/shared/components/data-table/types/entity-expanded-row'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { ProjectRowPanel } from '@/features/records-management/ui/components/project-row-panel'
import { ProjectsRecordsTable } from '@/features/records-management/ui/components/projects-records-table'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

// Module level keeps its identity stable, so the table's props don't churn.
function renderProjectRowPanel(row: ProjectRow, { actions }: EntityExpandedRowContext<ProjectRow>) {
  return <ProjectRowPanel project={row} actions={actions} />
}

export function ProjectsRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <ProjectsRecordsTable renderExpandedRow={renderProjectRowPanel} />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
