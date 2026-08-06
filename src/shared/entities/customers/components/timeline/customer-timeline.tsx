'use client'

import type { TimelineFilterId, TimelineFilterValue } from '@/shared/entities/customers/constants/timeline-view'
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
import { TimelineEventItem } from './timeline-event-item'
import { TimelineFilterChips } from './timeline-filter-chips'

interface Props {
  data: CustomerProfileData
  onOpenMeeting: (meetingId: string) => void
}

export function CustomerTimeline({ data, onOpenMeeting }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [activeFilter, setActiveFilter] = useState<TimelineFilterValue>('all')
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

  // Clicking the active chip again clears the filter back to the unfiltered view.
  function toggleFilter(id: TimelineFilterId) {
    setActiveFilter(prev => (prev === id ? 'all' : id))
  }

  return (
    <div className="space-y-3">
      {/* One control bar: the title anchors left, the filter chips and
          expand-all sit together on the right so no vertical row is spent on
          filtering. The chip strip scrolls horizontally rather than wrapping,
          keeping the expand icon pinned to the edge. */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="shrink-0 text-sm font-semibold text-foreground">Activity</h3>
        {all.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TimelineFilterChips counts={counts} onChange={toggleFilter} value={activeFilter} />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="size-7 shrink-0"
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
        )}
      </div>

      {all.length === 0
        ? (
            <EmptyState
              description="Notes, meetings, and proposals for this customer will appear here as they happen."
              title="No activity yet"
            />
          )
        : (
            <>
              {filtered.length === 0
                ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {`No ${activeFilterLabel.toLowerCase()} activity yet`}
                    </p>
                  )
                : (
                    <>
                      <div className="space-y-5">
                        {groups.map(group => (
                          <div key={group.label}>
                            <p className="mb-2 text-xs font-semibold text-foreground">{group.label}</p>
                            <ol className="relative space-y-1 border-l border-muted-foreground/15 pl-3">
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
