import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipCallSchema, selectVoipCallSchema, voipCalls } from '@/shared/db/schema'
import { VOIP_CALL } from './constants'
import { voipCallVisibility } from './visibility'

const updateVoipCallSchema = insertVoipCallSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipCallSchemas = {
  insert: insertVoipCallSchema,
  update: updateVoipCallSchema,
}

export const voipCallServerSpec = defineEntitySpec({
  entityName: VOIP_CALL,
  subject: VOIP_CALL,
  conditionColumns: ['agentUserId'],
  visibility: voipCallVisibility,
  table: voipCalls,
  schemas: {
    insert: insertVoipCallSchema,
    update: updateVoipCallSchema,
    select: selectVoipCallSchema,
  },
})
