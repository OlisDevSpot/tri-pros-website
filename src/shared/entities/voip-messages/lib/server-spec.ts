import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipMessageSchema, selectVoipMessageSchema, voipMessages } from '@/shared/db/schema'
import { VOIP_MESSAGE } from './constants'
import { voipMessageVisibility } from './visibility'

const updateVoipMessageSchema = insertVoipMessageSchema.partial()

export const voipMessageSchemas = {
  insert: insertVoipMessageSchema,
  update: updateVoipMessageSchema,
}

export const voipMessageServerSpec = defineEntitySpec({
  entityName: VOIP_MESSAGE,
  subject: VOIP_MESSAGE,
  conditionColumns: ['agentUserId'],
  visibility: voipMessageVisibility,
  table: voipMessages,
  schemas: {
    insert: insertVoipMessageSchema,
    update: updateVoipMessageSchema,
    select: selectVoipMessageSchema,
  },
})
