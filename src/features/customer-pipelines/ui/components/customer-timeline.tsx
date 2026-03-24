'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import { ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'

import { buildTimelineEvents } from '@/features/customer-pipelines/lib/build-timeline-events'
import { QuickNoteInput } from '@/features/customer-pipelines/ui/components/quick-note-input'
import { TimelineEventItem } from '@/features/customer-pipelines/ui/components/timeline-event-item'
import { Button } from '@/shared/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
}

export function CustomerTimeline({ data, onMutationSuccess }: Props) {
  const [expanded, setExpanded] = useState(false)
  const events = buildTimelineEvents(data)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-7"
                onClick={() => setExpanded(prev => !prev)}
                size="icon"
                variant="ghost"
              >
                {expanded
                  ? <ChevronsDownUpIcon className="size-4" />
                  : <ChevronsUpDownIcon className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{expanded ? 'Collapse' : 'Expand'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <QuickNoteInput customerId={data.customer.id} onSuccess={onMutationSuccess} />

      {events.length === 0
        ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No activity yet</p>
          )
        : (
            <div className="relative border-l border-border pl-3">
              {events.map(event => (
                <TimelineEventItem event={event} expanded={expanded} key={event.id} />
              ))}
            </div>
          )}
    </div>
  )
}
