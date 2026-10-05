'use client'

import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { Badge } from '@/shared/components/ui/badge'

/** Trades on the project, on the rail's Project button. Rendered by the view inside the provider. */
export function ProjectCountBadge() {
  const count = selectedTradeSelections(useTradeSelections()).length

  if (count === 0) {
    return null
  }

  return <Badge className="absolute top-0 right-0 h-4 min-w-4 px-1 text-xs tabular-nums">{count}</Badge>
}
