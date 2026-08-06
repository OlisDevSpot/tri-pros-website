import type { TimelineFilterId } from '@/shared/entities/customers/constants/timeline-view'
import type { TimelineEvent } from '@/shared/entities/customers/types/timeline'

import { TIMELINE_EVENT_CONFIG } from '@/shared/entities/customers/constants/timeline-event-config'
import { TIMELINE_FILTERS } from '@/shared/entities/customers/constants/timeline-view'

/** Per-filter-chip counts over the unfiltered event set. */
export function countTimelineEventsByFilter(events: TimelineEvent[]): Record<TimelineFilterId, number> {
  const counts = Object.fromEntries(TIMELINE_FILTERS.map(filter => [filter.id, 0])) as Record<TimelineFilterId, number>

  for (const event of events) {
    const category = TIMELINE_EVENT_CONFIG[event.type].category
    const filter = TIMELINE_FILTERS.find(f => f.category === category)
    if (filter) {
      counts[filter.id] += 1
    }
  }

  return counts
}
