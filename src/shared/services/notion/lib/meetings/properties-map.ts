import type { Meeting } from './schema'

export const MEETING_PROPERTIES_MAP = {
  title: 'Meeting',
  phone: 'Phone',
  notes: 'Notes',
  relatedContactId: 'Contact',
  salesrepsAssigned: 'Salesreps Assigned',
  meetingDatetime: 'Meeting Datetime',
} as const satisfies Omit<Record<keyof Meeting, string>, 'id'>
