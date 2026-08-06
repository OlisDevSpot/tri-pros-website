import type { TimelineFilterValue } from '@/shared/entities/customers/constants/timeline-view'
import type { TimelineEvent } from '@/shared/entities/customers/types/timeline'

import { TIMELINE_EVENT_CONFIG } from '@/shared/entities/customers/constants/timeline-event-config'
import { TIMELINE_FILTERS } from '@/shared/entities/customers/constants/timeline-view'

/** Filter reverse-chron events down to one filter chip's category. 'all' is a passthrough. */
export function filterTimelineEvents(events: TimelineEvent[], filterId: TimelineFilterValue): TimelineEvent[] {
  const filter = TIMELINE_FILTERS.find(f => f.id === filterId)
  if (!filter?.category) {
    return events
  }
  const category = filter.category
  return events.filter(event => TIMELINE_EVENT_CONFIG[event.type].category === category)
}
