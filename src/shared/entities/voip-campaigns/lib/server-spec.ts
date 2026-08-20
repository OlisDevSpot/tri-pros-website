import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipCampaignSchema, selectVoipCampaignSchema, voipCampaigns } from '@/shared/db/schema'
import { VOIP_CAMPAIGN } from './constants'

const updateVoipCampaignSchema = insertVoipCampaignSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipCampaignSchemas = {
  insert: insertVoipCampaignSchema,
  update: updateVoipCampaignSchema,
}

export const voipCampaignServerSpec = {
  entityName: VOIP_CAMPAIGN,
  caslSubject: VOIP_CAMPAIGN,
  table: voipCampaigns,
  schemas: {
    insert: insertVoipCampaignSchema,
    update: updateVoipCampaignSchema,
    select: selectVoipCampaignSchema,
  },
} satisfies EntityServerSpec<typeof voipCampaigns>
