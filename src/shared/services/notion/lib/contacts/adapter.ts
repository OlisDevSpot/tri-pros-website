import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Contact } from '@/shared/services/notion/lib/contacts/schema'
import { contactSchema } from '@/shared/services/notion/lib/contacts/schema'
import { dateISO, email, peopleIds, phone, relationIds, richText, selectName, titleText } from '../extractors'
import { CONTACT_PROPERTIES_MAP } from './properties-map'

export function pageToContact(page: PageObjectResponse): Contact {
  const p = page.properties

  const raw: Partial<Contact> = {
    id: page.id,
    name: titleText(p, CONTACT_PROPERTIES_MAP.name),
    email: email(p, CONTACT_PROPERTIES_MAP.email),
    address: richText(p, CONTACT_PROPERTIES_MAP.address),
    city: richText(p, CONTACT_PROPERTIES_MAP.city),
    state: selectName(p, CONTACT_PROPERTIES_MAP.state),
    zip: richText(p, CONTACT_PROPERTIES_MAP.zip),
    notes: richText(p, CONTACT_PROPERTIES_MAP.notes),
    phone: phone(p, CONTACT_PROPERTIES_MAP.phone),
    initMeetingAt: dateISO(p, CONTACT_PROPERTIES_MAP.initMeetingAt),
    ownerIds: peopleIds(p, CONTACT_PROPERTIES_MAP.ownerIds),
    relatedMeetingsIds: relationIds(p, CONTACT_PROPERTIES_MAP.relatedMeetingsIds),
    relatedProjectsIds: relationIds(p, CONTACT_PROPERTIES_MAP.relatedProjectsIds),
  }

  const valid = contactSchema.safeParse(raw)

  if (valid.success)
    return valid.data

  throw new Error(valid.error.message)
}
