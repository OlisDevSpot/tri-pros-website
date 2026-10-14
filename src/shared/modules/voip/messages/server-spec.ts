import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipMessageSchema, selectVoipMessageSchema, voipMessages } from '@/shared/db/schema'
import { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'
import { VOIP_MESSAGE } from '@/shared/modules/voip/messages/lib/constants'

const updateVoipMessageSchema = insertVoipMessageSchema.partial()

export const voipMessageSchemas = {
  insert: insertVoipMessageSchema,
  update: updateVoipMessageSchema,
}

// Whoever may read a line reads its texts; the sender column decides nothing about who sees them.
export const voipMessageServerSpec = defineEntitySpec({
  entityName: VOIP_MESSAGE,
  subject: VOIP_MESSAGE,
  conditionColumns: [],
  parent: { spec: voipDidServerSpec, fk: voipMessages.voipDidId },
  table: voipMessages,
  schemas: {
    insert: insertVoipMessageSchema,
    update: updateVoipMessageSchema,
    select: selectVoipMessageSchema,
  },
})
