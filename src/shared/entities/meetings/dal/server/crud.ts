import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

/** Stable CRUD handlers for the meetings entity. Single instance, fully typed. */
export const meetingCrud = createCrudDal(meetingServerSpec)
