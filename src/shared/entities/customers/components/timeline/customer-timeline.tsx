'use client'

import type { TimelineFilterId } from '@/shared/entities/customers/constants/timeline-view'
import type { CustomerProfileData } from '@/shared/entities/customers/types'

import { ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/shared/components/states/empty-state'
import { Button } from '@/shared/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { TIMELINE_FILTERS, TIMELINE_PAGE_CAP } from '@/shared/entities/customers/constants/timeline-view'
import { bucketTimelineEvents } from '@/shared/entities/customers/lib/bucket-timeline-events'
import { buildTimelineEvents } from '@/shared/entities/customers/lib/build-timeline-events'
import { countTimelineEventsByFilter } from '@/shared/entities/customers/lib/count-timeline-events-by-filter'
import { filterTimelineEvents } from '@/shared/entities/customers/lib/filter-timeline-events'
import { QuickNoteInput } from './quick-note-input'
import { TimelineEventItem } from './timeline-event-item'
import { TimelineFilterChips } from './timeline-filter-chips'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
  onOpenMeeting: (meetingId: string) => void
}

export function CustomerTimeline({ data, onMutationSuccess, onOpenMeeting }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [activeFilter, setActiveFilter] = useState<TimelineFilterId>('all')
  const [showAll, setShowAll] = useState(false)

  const all = buildTimelineEvents(data)
  const counts = countTimelineEventsByFilter(all)
  const filtered = filterTimelineEvents(all, activeFilter)
  const visible = showAll ? filtered : filtered.slice(0, TIMELINE_PAGE_CAP)
  const groups = bucketTimelineEvents(visible)

  const allExpanded = visible.length > 0 && visible.every(event => expandedIds.has(event.id))
  const hasEarlierActivity = filtered.length > TIMELINE_PAGE_CAP && !showAll
  const activeFilterLabel = TIMELINE_FILTERS.find(filter => filter.id === activeFilter)?.label ?? 'All'

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
    setExpandedIds(allExpanded ? new Set() : new Set(visible.map(event => event.id)))
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

      {all.length === 0
        ? (
            <EmptyState
              description="Notes and activity from meetings and proposals will show up here — add the first note above."
              title="No activity yet"
            />
          )
        : (
            <>
              <TimelineFilterChips counts={counts} onChange={setActiveFilter} value={activeFilter} />

              {filtered.length === 0
                ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {`No ${activeFilterLabel.toLowerCase()} activity yet`}
                    </p>
                  )
                : (
                    <>
                      <div className="space-y-4">
                        {groups.map(group => (
                          <div key={group.label}>
                            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
                            <ol className="relative border-l border-border pl-3">
                              {group.events.map(event => (
                                <li key={event.id}>
                                  <TimelineEventItem
                                    customerId={data.customer.id}
                                    event={event}
                                    isExpanded={expandedIds.has(event.id)}
                                    onOpenMeeting={onOpenMeeting}
                                    onToggle={toggleEvent}
                                  />
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>

                      {hasEarlierActivity && (
                        <Button
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => setShowAll(true)}
                          size="sm"
                          variant="ghost"
                        >
                          Show earlier activity
                        </Button>
                      )}
                    </>
                  )}
            </>
          )}
    </div>
  )
}
