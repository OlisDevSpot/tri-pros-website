import type { Contact } from '@/shared/services/notion/lib/contacts/schema'
import type { RawPropertyMap } from '@/shared/services/notion/types'

export const CONTACT_PROPERTIES_MAP = {
  name: {
    label: 'Name',
    type: 'title',
  },
  email: {
    label: 'Email',
    type: 'rich_text',
  },
  address: {
    label: 'Address',
    type: 'rich_text',
  },
  city: {
    label: 'City',
    type: 'rich_text',
  },
  state: {
    label: 'State',
    type: 'select',
  },
  zip: {
    label: 'Zip',
    type: 'rich_text',
  },
  notes: {
    label: 'Notes',
    type: 'rich_text',
  },
  phone: {
    label: 'Phone',
    type: 'phone_number',
  },
  ownerId: {
    label: 'Owner',
    type: 'people',
  },
  relatedMeetingsIds: {
    label: 'Meetings',
    type: 'relation',
  },
  relatedProjectsIds: {
    label: 'Projects',
    type: 'relation',
  },
  initMeetingAt: {
    label: 'Init Meeting Datetime',
    type: 'date',
  },
} as const satisfies RawPropertyMap<Contact>
