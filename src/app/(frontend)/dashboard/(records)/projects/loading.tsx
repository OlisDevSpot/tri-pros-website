import { ProjectsRoutePendingView } from '@/features/agent-dashboard/ui/components/projects-route-pending-view'
import { DataViewPending } from '@/shared/components/data-view-pending'

export default function ProjectsLoading() {
  return (
    <DataViewPending>
      <ProjectsRoutePendingView />
    </DataViewPending>
  )
}
