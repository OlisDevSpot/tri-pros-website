import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { ACTIVITY_FIELDS } from '@/shared/entities/activities/dal/activity-fields'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'

/** A busy month can pass this; the calendar then says "Showing 500 of N" rather than dropping rows. */
export const SCHEDULE_ROW_CAP = 500

export const SCHEDULE_SHOW_VALUES = ['meetings', 'activities'] as const
export type ScheduleShow = (typeof SCHEDULE_SHOW_VALUES)[number]

export const SCHEDULE_SHOW_LABELS: Record<ScheduleShow, string> = {
  meetings: 'Meetings',
  activities: 'Activities',
}

export const SCHEDULE_MEETINGS_QUERY = {
  fields: MEETING_FIELDS,
  // `ROOTS.dashboard.scheduleWithMeetingHighlight` writes `s_d`; change both together.
  paramPrefix: 's',
  toolbar: ['meetingType', 'outcome', 'trade', 'rep', 'leadSource', 'proposalStatus'],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  window: { kind: 'date', field: 'scheduledFor', cap: SCHEDULE_ROW_CAP },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

export const SCHEDULE_ACTIVITIES_QUERY = {
  fields: ACTIVITY_FIELDS,
  paramPrefix: 's',
  // Both configs share the `s` prefix so the date window survives the Show toggle; a toolbar id in both would carry one entity's filter into the other.
  toolbar: ['type', 'entityType', 'ownerId'] as const satisfies readonly Exclude<ToolbarFilterId<typeof ACTIVITY_FIELDS>, (typeof SCHEDULE_MEETINGS_QUERY)['toolbar'][number]>[],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  window: { kind: 'date', field: 'scheduledFor', cap: SCHEDULE_ROW_CAP },
} as const satisfies DataViewQueryConfig<typeof ACTIVITY_FIELDS>
