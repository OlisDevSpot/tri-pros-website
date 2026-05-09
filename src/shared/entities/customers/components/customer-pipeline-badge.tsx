import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { Badge } from '@/shared/components/ui/badge'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { cn } from '@/shared/lib/utils'

/**
 * Colored badge for a customer's pipeline bucket. Reads against the canonical
 * 5-bucket `pipelines` enum (`projects | fresh | leads | rehash | dead`) —
 * the rendering surface gets a value already exploded server-side via
 * `derivedPipelineSql`. Colors align with the kanban `badgeColorMap`
 * palette so a customer's bucket reads the same here as on the board.
 */
interface CustomerPipelineBadgeProps {
  pipeline: Pipeline | null | undefined
  className?: string
}

const PIPELINE_CLASSES: Record<Pipeline, string> = {
  projects: 'bg-green-500/10 text-green-700 dark:text-green-400',
  fresh: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  leads: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  rehash: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  dead: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
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
