import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipCampaignSchema, selectVoipCampaignSchema, voipCampaigns } from '@/shared/db/schema'
import { VOIP_CAMPAIGN } from './constants'
import { voipCampaignVisibility } from './visibility'

const updateVoipCampaignSchema = insertVoipCampaignSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipCampaignSchemas = {
  insert: insertVoipCampaignSchema,
  update: updateVoipCampaignSchema,
}

export const voipCampaignServerSpec = defineEntitySpec({
  entityName: VOIP_CAMPAIGN,
  subject: VOIP_CAMPAIGN,
  conditionColumns: [],
  visibility: voipCampaignVisibility,
  table: voipCampaigns,
  schemas: {
    insert: insertVoipCampaignSchema,
    update: updateVoipCampaignSchema,
    select: selectVoipCampaignSchema,
  },
})
