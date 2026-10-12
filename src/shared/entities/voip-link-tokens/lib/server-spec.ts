import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipLinkTokenSchema, selectVoipLinkTokenSchema, voipLinkTokens } from '@/shared/db/schema'
import { VOIP_LINK_TOKEN } from './constants'
import { voipLinkTokenVisibility } from './visibility'

const updateVoipLinkTokenSchema = insertVoipLinkTokenSchema.partial()

export const voipLinkTokenSchemas = {
  insert: insertVoipLinkTokenSchema,
  update: updateVoipLinkTokenSchema,
}

export const voipLinkTokenServerSpec = defineEntitySpec({
  entityName: VOIP_LINK_TOKEN,
  subject: VOIP_LINK_TOKEN,
  conditionColumns: ['createdByUserId'],
  visibility: voipLinkTokenVisibility,
  table: voipLinkTokens,
  schemas: {
    insert: insertVoipLinkTokenSchema,
    update: updateVoipLinkTokenSchema,
    select: selectVoipLinkTokenSchema,
  },
})
