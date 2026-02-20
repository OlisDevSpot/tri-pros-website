import type { Contact } from '@/shared/services/notion/lib/contacts/schema'

export const CONTACT_PROPERTIES_MAP = {
  name: 'Name',
  email: 'Email',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'Zip',
  ownerIds: 'Contact Owner',
  notes: 'Notes',
  phone: 'Phone',
  relatedMeetingsIds: 'Meetings',
  relatedProjectsIds: 'Projects',
  initMeetingAt: 'Init Meeting Datetime',
} as const satisfies Omit<Record<keyof Contact, string>, 'id'>
