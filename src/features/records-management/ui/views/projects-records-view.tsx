'use client'

import { ProjectsRecordsTable } from '@/features/records-management/ui/components/projects-records-table'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

export function ProjectsRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <ProjectsRecordsTable />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
