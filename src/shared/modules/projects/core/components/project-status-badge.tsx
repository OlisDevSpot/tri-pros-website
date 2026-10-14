import type { ProjectStatusBucket } from '@/shared/constants/enums'

import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { PROJECT_STATUS_BUCKET_COLORS } from '@/shared/modules/projects/core/constants/status-colors'
import { PROJECT_STATUS_BUCKET_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

interface Props {
  bucket: ProjectStatusBucket
  className?: string
}

export function ProjectStatusBadge({ bucket, className }: Props) {
  return (
    <Badge className={cn('text-xs', PROJECT_STATUS_BUCKET_COLORS[bucket], className)}>
      {PROJECT_STATUS_BUCKET_LABELS[bucket]}
    </Badge>
  )
}
