import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipCallServerSpec } from '@/shared/entities/voip-calls/lib/server-spec'

/** Stable CRUD handlers for the voip-calls entity. Single instance, fully typed. */
export const voipCallCrud = createCrudDal(voipCallServerSpec)
