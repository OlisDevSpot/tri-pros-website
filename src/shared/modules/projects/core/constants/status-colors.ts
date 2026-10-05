import type { ProjectStatusBucket } from '@/shared/constants/enums'
import type { StatusTone } from '@/shared/constants/status-tones'

import { TONE_CLASSES } from '@/shared/constants/status-tones'

const PROJECT_STATUS_BUCKET_TONE: Record<ProjectStatusBucket, StatusTone> = {
  active: 'info',
  completed: 'success',
  on_hold: 'attention',
  cancelled: 'danger',
}

export const PROJECT_STATUS_BUCKET_COLORS = Object.fromEntries(
  Object.entries(PROJECT_STATUS_BUCKET_TONE).map(([bucket, tone]) => [bucket, TONE_CLASSES[tone].fill]),
) as Record<ProjectStatusBucket, string>
