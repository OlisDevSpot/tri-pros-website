import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipCampaignContactServerSpec } from '@/shared/entities/voip-campaign-contacts/lib/server-spec'

/** Stable CRUD handlers for the voip-campaign-contacts entity. Single instance, fully typed. */
export const voipCampaignContactCrud = createCrudDal(voipCampaignContactServerSpec)
