'use client'

import { PortfolioProjectsTable } from '@/features/project-management/ui/components/table'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function ProjectsRoutePendingView() {
  return (
    <RecordsPageMotionShell>
      <PortfolioProjectsTable />
    </RecordsPageMotionShell>
  )
}
