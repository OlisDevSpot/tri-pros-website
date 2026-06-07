import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipCampaignServerSpec } from '@/shared/entities/voip-campaigns/lib/server-spec'

/** Stable CRUD handlers for the voip-campaigns entity. Single instance, fully typed. */
export const voipCampaignCrud = createCrudDal(voipCampaignServerSpec)
