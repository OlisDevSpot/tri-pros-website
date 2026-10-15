import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipMessageServerSpec } from '@/shared/modules/voip/messages/server-spec'

/** Stable CRUD handlers for texts. A text is created inside a conversation that already exists. */
export const voipMessageCrud = createCrudDal(voipMessageServerSpec)
