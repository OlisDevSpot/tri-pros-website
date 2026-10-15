import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
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
export const meetingMessageServerSpec = defineSubEntitySpec({
  entityName: MEETING_MESSAGE,
  table: meetingMessages,
  schemas: {
    insert: insertMeetingMessageSchema,
    update: updateMeetingMessageSchema,
    select: selectMeetingMessageSchema,
  },
  parent: { spec: meetingServerSpec, fk: meetingMessages.meetingId, field: 'visitMessages' },
})
