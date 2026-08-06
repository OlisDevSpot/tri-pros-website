import type { TimelineEventCategory } from './timeline-event-config'

export const TIMELINE_PAGE_CAP = 25

// Only real categories are chips. There is no "All" chip: an unselected state
// (the 'all' sentinel below) already means "no filter", and toggling the active
// chip off returns to it — one fewer badge to fit on the row.
export const TIMELINE_FILTERS = [
  { id: 'note', label: 'Notes', category: 'note' },
  { id: 'meeting', label: 'Meetings', category: 'meeting' },
  { id: 'proposal', label: 'Proposals', category: 'proposal' },
] as const satisfies readonly { id: string, label: string, category: TimelineEventCategory }[]

export type TimelineFilterId = (typeof TIMELINE_FILTERS)[number]['id']

// The active selection is either a chip's id or the 'all' sentinel (no chip
// selected = the default, unfiltered view). 'all' is never rendered as a chip.
export type TimelineFilterValue = TimelineFilterId | 'all'
