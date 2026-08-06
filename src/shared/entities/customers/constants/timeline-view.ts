import type { TimelineEventCategory } from './timeline-event-config'

export const TIMELINE_PAGE_CAP = 25

export const TIMELINE_FILTERS = [
  { id: 'all', label: 'All', category: null },
  { id: 'note', label: 'Notes', category: 'note' },
  { id: 'meeting', label: 'Meetings', category: 'meeting' },
  { id: 'proposal', label: 'Proposals', category: 'proposal' },
] as const satisfies readonly { id: string, label: string, category: TimelineEventCategory | null }[]

export type TimelineFilterId = (typeof TIMELINE_FILTERS)[number]['id']
