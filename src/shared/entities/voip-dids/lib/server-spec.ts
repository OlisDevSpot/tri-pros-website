import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipDidSchema, selectVoipDidSchema, voipDids } from '@/shared/db/schema'
import { VOIP_DID } from './constants'

const updateVoipDidSchema = insertVoipDidSchema.partial()

export const voipDidSchemas = {
  insert: insertVoipDidSchema,
  update: updateVoipDidSchema,
}

export const voipDidServerSpec = {
  entityName: VOIP_DID,
  caslSubject: VOIP_DID,
  table: voipDids,
  schemas: {
    insert: insertVoipDidSchema,
    update: updateVoipDidSchema,
    select: selectVoipDidSchema,
  },
} satisfies EntityServerSpec<typeof voipDids>
