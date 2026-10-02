import type { ProjectStatusBucket, ProjectVisibility } from '@/shared/constants/enums'

export const PROJECT_STATUS_BUCKET_LABELS: Record<ProjectStatusBucket, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  public: 'Public',
  draft: 'Draft',
}
