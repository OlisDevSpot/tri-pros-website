import type { RawPropertyMap } from '../../types'
import type { Meeting } from './schema'

export const MEETING_PROPERTIES_MAP = {
  title: {
    label: 'Meeting',
    type: 'title',
  },
  phone: {
    label: 'Phone',
    type: 'phone_number',
  },
  notes: {
    label: 'Notes',
    type: 'rich_text',
  },
  relatedContactId: {
    label: 'Contact',
    type: 'relation',
  },
  salesrepsAssigned: {
    label: 'Salesreps Assigned',
    type: 'people',
  },
  meetingDatetime: {
    label: 'Meeting Datetime',
    type: 'date',
  },
} as const satisfies RawPropertyMap<Meeting>

export type MeetingPropertiesMap = typeof MEETING_PROPERTIES_MAP
