import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Meeting } from '@/shared/services/notion/lib/meetings/schema'
import { meetingSchema } from '@/shared/services/notion/lib/meetings/schema'
import { dateISO, peopleIds, phone, relationIds, richText, titleText } from '../extractors'
import { MEETING_PROPERTIES_MAP } from './properties-map'

export function pageToMeeting(page: PageObjectResponse): Meeting {
  const p = page.properties

  const raw: Partial<Meeting> = {
    id: page.id,
    title: titleText(p, MEETING_PROPERTIES_MAP.title),
    notes: richText(p, MEETING_PROPERTIES_MAP.notes),
    phone: phone(p, MEETING_PROPERTIES_MAP.phone),
    meetingDatetime: dateISO(p, MEETING_PROPERTIES_MAP.meetingDatetime),
    salesrepsAssigned: peopleIds(p, MEETING_PROPERTIES_MAP.salesrepsAssigned),
    relatedContactId: relationIds(p, MEETING_PROPERTIES_MAP.relatedContactId)[0],
  }

  const valid = meetingSchema.safeParse(raw)

  if (valid.success)
    return valid.data

  throw new Error(valid.error.message)
}
