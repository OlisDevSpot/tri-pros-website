import type { CustomerPipeline } from '@/shared/constants/enums'

import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

/**
 * Colored badge for a customer's pipeline bucket. Colors align with the
 * kanban stage palette (`badgeColorMap`) so a customer's status reads the
 * same here as on the board.
 */
interface CustomerPipelineBadgeProps {
  pipeline: CustomerPipeline | null | undefined
  className?: string
}

const PIPELINE_CLASSES: Record<CustomerPipeline, string> = {
  active: 'bg-green-500/10 text-green-700 dark:text-green-400',
  rehash: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  dead: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
}

const PIPELINE_LABELS: Record<CustomerPipeline, string> = {
  active: 'Active',
  rehash: 'Rehash',
  dead: 'Dead',
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
