import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipLinkTokenServerSpec } from '@/shared/entities/voip-link-tokens/lib/server-spec'

/** Stable CRUD handlers for the voip-link-tokens entity. Single instance, fully typed. */
export const voipLinkTokenCrud = createCrudDal(voipLinkTokenServerSpec)
