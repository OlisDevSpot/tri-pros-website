import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipCampaignSchema, selectVoipCampaignSchema, voipCampaigns } from '@/shared/db/schema'
import { VOIP_CAMPAIGN } from './constants'
import { voipCampaignVisibility } from './visibility'

const updateVoipCampaignSchema = insertVoipCampaignSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipCampaignSchemas = {
  insert: insertVoipCampaignSchema,
  update: updateVoipCampaignSchema,
}

export const voipCampaignServerSpec = {
  entityName: VOIP_CAMPAIGN,
  caslSubject: VOIP_CAMPAIGN,
  visibility: voipCampaignVisibility,
  table: voipCampaigns,
  schemas: {
    insert: insertVoipCampaignSchema,
    update: updateVoipCampaignSchema,
    select: selectVoipCampaignSchema,
  },
} satisfies EntityServerSpec<typeof voipCampaigns>
