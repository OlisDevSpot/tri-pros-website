import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipMessageServerSpec } from '@/shared/modules/voip/messages/server-spec'

/** Stable CRUD handlers for the voip-messages entity. Single instance, fully typed. */
export const voipMessageCrud = createCrudDal(voipMessageServerSpec)
