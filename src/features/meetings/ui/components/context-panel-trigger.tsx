'use client'

import { ClipboardListIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'

interface ContextPanelTriggerProps {
  filledCount: number
  totalCount: number
  onClick: () => void
}

export function ContextPanelTrigger({ filledCount, onClick, totalCount }: ContextPanelTriggerProps) {
  return (
    <div className="fixed bottom-[calc(var(--prevNextHeight,3.5rem)+1rem)] left-4 z-40 md:bottom-6">
      <Button
        aria-label="Open context panel"
        className="relative h-10 gap-2 rounded-full pl-3 pr-4 shadow-lg"
        size="sm"
        variant="secondary"
        onClick={onClick}
      >
        <ClipboardListIcon className="size-4 shrink-0" />
        <span className="text-xs font-medium">Context</span>
        <Badge
          className="h-4 min-w-[2rem] px-1.5 text-[9px] tabular-nums"
          variant={filledCount > 0 ? 'default' : 'outline'}
        >
          {`${filledCount}/${totalCount}`}
        </Badge>
      </Button>
    </div>
  )
}
