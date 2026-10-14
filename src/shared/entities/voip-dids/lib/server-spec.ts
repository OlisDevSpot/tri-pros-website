import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipDidSchema, selectVoipDidSchema, voipDids } from '@/shared/db/schema'
import { VOIP_DID } from './constants'

const updateVoipDidSchema = insertVoipDidSchema.partial()

export const voipDidSchemas = {
  insert: insertVoipDidSchema,
  update: updateVoipDidSchema,
}

// A line is reached by rules on its own columns; its texts and conversations are reached through it.
export const voipDidServerSpec = defineEntitySpec({
  entityName: VOIP_DID,
  subject: VOIP_DID,
  conditionColumns: ['assignedUserId', 'isMainLine'],
  table: voipDids,
  schemas: {
    insert: insertVoipDidSchema,
    update: updateVoipDidSchema,
    select: selectVoipDidSchema,
  },
})
