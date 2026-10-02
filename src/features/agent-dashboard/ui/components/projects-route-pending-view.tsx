'use client'

import { PortfolioProjectsTable } from '@/features/project-management/ui/components/table'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function ProjectsRoutePendingView() {
  return (
    <RecordsPageFrame>
      <PortfolioProjectsTable />
    </RecordsPageFrame>
  )
}
