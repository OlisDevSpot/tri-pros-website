import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipDidSchema, selectVoipDidSchema, voipDids } from '@/shared/db/schema'
import { VOIP_DID } from './constants'
import { voipDidVisibility } from './visibility'

const updateVoipDidSchema = insertVoipDidSchema.partial()

export const voipDidSchemas = {
  insert: insertVoipDidSchema,
  update: updateVoipDidSchema,
}

export const voipDidServerSpec = defineEntitySpec({
  entityName: VOIP_DID,
  subject: VOIP_DID,
  conditionColumns: ['assignedUserId'],
  visibility: voipDidVisibility,
  table: voipDids,
  schemas: {
    insert: insertVoipDidSchema,
    update: updateVoipDidSchema,
    select: selectVoipDidSchema,
  },
})
