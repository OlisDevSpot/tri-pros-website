import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertMeetingSchema,
  meetings,
  selectMeetingSchema,
} from '@/shared/db/schema'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { meetingVisibility } from '@/shared/entities/meetings/lib/visibility'

const updateMeetingSchema = insertMeetingSchema.partial()

const SERVER_OWNED_COLUMNS = {
  shareToken: true,
  homeownerConfirmedAt: true,
  homeownerConfirmedVia: true,
  newTimeRequestedAt: true,
  rescheduledFromId: true,
} as const

/**
 * The crud router's schemas. Only server code writes these columns, and Zod strips an unknown key,
 * so a client that sends one writes nothing. The DAL keeps the full schemas: it parses after the hooks run.
 */
export const meetingClientSchemas = {
  insert: insertMeetingSchema.omit(SERVER_OWNED_COLUMNS),
  update: updateMeetingSchema.omit(SERVER_OWNED_COLUMNS),
}

export const meetingServerSpec = {
  entityName: MEETING,
  caslSubject: MEETING,
  visibility: meetingVisibility,
  table: meetings,
  schemas: {
    insert: insertMeetingSchema,
    update: updateMeetingSchema,
    select: selectMeetingSchema,
  },
} satisfies EntityServerSpec<typeof meetings>
