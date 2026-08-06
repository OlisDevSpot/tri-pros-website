'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'

import { ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { buildTimelineEvents } from '@/shared/entities/customers/lib/build-timeline-events'
import { QuickNoteInput } from './quick-note-input'
import { TimelineEventItem } from './timeline-event-item'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
}

// NOTE: this container is a compile-compatibility stub for the new per-event
// TimelineEventItem contract (Task 7) — expand-all/collapse-all here is a
// simple "toggle every currently-rendered id" shim, and `onOpenMeeting` is a
// no-op until navigation is wired. The real rebuild (filter chips, date
// buckets, show-earlier, a real onOpenMeeting threaded from the profile
// modal) lands in Tasks 8/9/11 — see
// docs/superpowers/plans/2026-08-05-customer-activity-center-and-notes-entity.md.
export function CustomerTimeline({ data, onMutationSuccess }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const events = buildTimelineEvents(data)
  const allExpanded = events.length > 0 && events.every(event => expandedIds.has(event.id))

  function toggleEvent(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    setExpandedIds(allExpanded ? new Set() : new Set(events.map(event => event.id)))
  }

  function handleOpenMeeting() {
    // Click-through navigation lands in Task 11 (controlled Tabs + highlight).
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-7"
                onClick={toggleAll}
                size="icon"
                variant="ghost"
              >
                {allExpanded
                  ? <ChevronsDownUpIcon className="size-4" />
                  : <ChevronsUpDownIcon className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{allExpanded ? 'Collapse' : 'Expand'}</p>
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
                <TimelineEventItem
                  customerId={data.customer.id}
                  event={event}
                  isExpanded={expandedIds.has(event.id)}
                  key={event.id}
                  onOpenMeeting={handleOpenMeeting}
                  onToggle={toggleEvent}
                />
              ))}
            </div>
          )}
    </div>
  )
}
