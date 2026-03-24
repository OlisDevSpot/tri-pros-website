'use client'

import type { TimelineEvent } from '@/features/customer-pipelines/types/timeline'

import { formatDistanceToNow } from 'date-fns'

import { TIMELINE_EVENT_CONFIG } from '@/features/customer-pipelines/constants/timeline-event-config'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'

interface Props {
  event: TimelineEvent
  expanded: boolean
}

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TimelineEventItem({ event, expanded }: Props) {
  const config = TIMELINE_EVENT_CONFIG[event.type]
  const Icon = config.icon
  const relativeTime = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })
  const fullDate = formatFullDate(event.timestamp)

  if (!expanded) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <Icon className={`size-3.5 shrink-0 ${config.color}`} />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {event.title}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime}</span>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{fullDate}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-3.5 shrink-0 ${config.color}`} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{event.title}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime}</span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{fullDate}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground">{event.description}</p>
          )}
          {event.metadata && (
            <div className="flex flex-wrap gap-2">
              {typeof event.metadata.trade === 'string' && event.metadata.trade && (
                <span className="text-xs text-muted-foreground">
                  {`Trade: ${event.metadata.trade}`}
                </span>
              )}
              {typeof event.metadata.value === 'number' && event.metadata.value > 0 && (
                <span className="text-xs text-muted-foreground">
                  {`$${event.metadata.value.toLocaleString()}`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
