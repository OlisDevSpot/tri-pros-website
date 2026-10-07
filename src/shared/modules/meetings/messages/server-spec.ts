import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertMeetingMessageSchema,
  meetingMessages,
  selectMeetingMessageSchema,
} from '@/shared/db/schema/meeting-messages'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { MEETING_MESSAGE } from '@/shared/modules/meetings/messages/lib/constants'

const updateMeetingMessageSchema = insertMeetingMessageSchema.partial()

/**
 * No visibility of its own: whoever can see the meeting sees its visit messages.
 * Who reaches the visit-message surfaces at all is the VisitMessages gate on the procedure.
 */
export const meetingMessageServerSpec = {
  entityName: MEETING_MESSAGE,
  caslSubject: meetingServerSpec.caslSubject,
  parent: { spec: meetingServerSpec, fk: meetingMessages.meetingId },
  table: meetingMessages,
  schemas: {
    insert: insertMeetingMessageSchema,
    update: updateMeetingMessageSchema,
    select: selectMeetingMessageSchema,
  },
} satisfies EntityServerSpec<typeof meetingMessages>
