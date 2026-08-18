import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertMeetingSchema,
  meetings,
  selectMeetingSchema,
} from '@/shared/db/schema'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { meetingVisibility } from '@/shared/entities/meetings/lib/visibility'

const updateMeetingSchema = insertMeetingSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference. */
export const meetingSchemas = {
  insert: insertMeetingSchema,
  update: updateMeetingSchema,
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
