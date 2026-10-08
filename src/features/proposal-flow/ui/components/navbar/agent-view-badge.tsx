'use client'

import { ShieldIcon } from 'lucide-react'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { Badge } from '@/shared/components/ui/badge'

export function AgentViewBadge() {
  // CASL-gated: a homeowner holding a ?view=agent link still reads 'customer'.
  const viewMode = useViewMode()

  if (viewMode !== 'agent') {
    return null
  }

  return (
    <Badge variant="secondary" className="h-7 shrink-0 gap-1.5 px-2 print:hidden">
      <ShieldIcon aria-hidden />
      <span className="max-sm:sr-only">Agent view</span>
    </Badge>
  )
}
