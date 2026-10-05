import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipCallSchema, selectVoipCallSchema, voipCalls } from '@/shared/db/schema'
import { VOIP_CALL } from './constants'
import { voipCallVisibility } from './visibility'

const updateVoipCallSchema = insertVoipCallSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipCallSchemas = {
  insert: insertVoipCallSchema,
  update: updateVoipCallSchema,
}

export const voipCallServerSpec = {
  entityName: VOIP_CALL,
  caslSubject: VOIP_CALL,
  visibility: voipCallVisibility,
  table: voipCalls,
  schemas: {
    insert: insertVoipCallSchema,
    update: updateVoipCallSchema,
    select: selectVoipCallSchema,
  },
} satisfies EntityServerSpec<typeof voipCalls>
