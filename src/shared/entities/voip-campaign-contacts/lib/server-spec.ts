import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipCampaignContactSchema, selectVoipCampaignContactSchema, voipCampaignContacts } from '@/shared/db/schema'
import { VOIP_CAMPAIGN_CONTACT } from './constants'
import { voipCampaignContactVisibility } from './visibility'

const updateVoipCampaignContactSchema = insertVoipCampaignContactSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipCampaignContactSchemas = {
  insert: insertVoipCampaignContactSchema,
  update: updateVoipCampaignContactSchema,
}

export const voipCampaignContactServerSpec = {
  entityName: VOIP_CAMPAIGN_CONTACT,
  caslSubject: VOIP_CAMPAIGN_CONTACT,
  visibility: voipCampaignContactVisibility,
  table: voipCampaignContacts,
  // PK is `customer_id` (1:1 with customers), not `id`.
  primaryKey: 'customerId',
  schemas: {
    insert: insertVoipCampaignContactSchema,
    update: updateVoipCampaignContactSchema,
    select: selectVoipCampaignContactSchema,
  },
} satisfies EntityServerSpec<typeof voipCampaignContacts>
