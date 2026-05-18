import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Contact } from '@/shared/services/notion/lib/contacts/schema'
import { contactSchema } from '@/shared/services/notion/lib/contacts/schema'
import { dateISO, email, peopleIds, phone, relationIds, richText, selectName, titleText } from '../extractors'
import { CONTACT_PROPERTIES_MAP } from './properties-map'

export function pageToContact(page: PageObjectResponse): Contact {
  const p = page.properties

  const raw: Partial<Contact> = {
    id: page.id,
    name: titleText(p, CONTACT_PROPERTIES_MAP.name.label),
    email: email(p, CONTACT_PROPERTIES_MAP.email.label),
    address: richText(p, CONTACT_PROPERTIES_MAP.address.label),
    city: richText(p, CONTACT_PROPERTIES_MAP.city.label),
    state: selectName(p, CONTACT_PROPERTIES_MAP.state.label),
    zip: richText(p, CONTACT_PROPERTIES_MAP.zip.label),
    notes: richText(p, CONTACT_PROPERTIES_MAP.notes.label),
    phone: phone(p, CONTACT_PROPERTIES_MAP.phone.label),
    initMeetingAt: dateISO(p, CONTACT_PROPERTIES_MAP.initMeetingAt.label),
    ownerId: peopleIds(p, CONTACT_PROPERTIES_MAP.ownerId.label),
    relatedMeetingsIds: relationIds(p, CONTACT_PROPERTIES_MAP.relatedMeetingsIds.label),
    relatedProjectsIds: relationIds(p, CONTACT_PROPERTIES_MAP.relatedProjectsIds.label),
  }

  const valid = contactSchema.safeParse(raw)

  if (valid.success)
    return valid.data

  throw new Error(valid.error.message)
}
