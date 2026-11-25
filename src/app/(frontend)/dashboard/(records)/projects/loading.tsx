import { ProjectsRecordsView } from '@/features/records-management/ui/views/projects-records-view'
import { DataViewPending } from '@/shared/components/data-view/core/ui/pending'

export default function ProjectsLoading() {
  return (
    <DataViewPending>
      <ProjectsRecordsView />
    </DataViewPending>
  )
}
