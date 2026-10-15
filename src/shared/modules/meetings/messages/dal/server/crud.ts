import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { meetingMessageServerSpec } from '@/shared/modules/meetings/messages/server-spec'

export const meetingMessageCrud = createCrudDal(meetingMessageServerSpec)
