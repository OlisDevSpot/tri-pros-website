import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { Badge } from '@/shared/components/ui/badge'
import { TONE_CLASSES } from '@/shared/constants/status-tones'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { cn } from '@/shared/lib/utils'

/**
 * Colored badge for a customer's pipeline bucket. Reads against the canonical
 * 5-bucket `pipelines` enum (`projects | fresh | leads | rehash | dead`) —
 * the rendering surface gets a value already exploded server-side via
 * `derivedPipelineSql`. Tones match the kanban badges (status-tones) so a
 * customer's bucket reads the same here as on the board.
 */
interface CustomerPipelineBadgeProps {
  pipeline: Pipeline | null | undefined
  className?: string
}

const PIPELINE_CLASSES: Record<Pipeline, string> = {
  projects: TONE_CLASSES.success.fill,
  fresh: TONE_CLASSES.info.fill,
  leads: TONE_CLASSES.action.fill,
  rehash: TONE_CLASSES.pending.fill,
  dead: TONE_CLASSES.idle.fill,
}

export function CustomerPipelineBadge({ pipeline, className }: CustomerPipelineBadgeProps) {
  if (!pipeline) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <Badge
      variant="secondary"
      className={cn('border-transparent', PIPELINE_CLASSES[pipeline], className)}
    >
      {PIPELINE_LABELS[pipeline]}
    </Badge>
  )
}
