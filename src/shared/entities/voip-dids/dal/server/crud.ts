import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'

/** Stable CRUD handlers for the voip-dids entity. Single instance, fully typed. */
export const voipDidCrud = createCrudDal(voipDidServerSpec)
