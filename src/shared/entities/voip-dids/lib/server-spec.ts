import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipDidSchema, selectVoipDidSchema, voipDids } from '@/shared/db/schema'
import { VOIP_DID } from './constants'
import { voipDidVisibility } from './visibility'

const updateVoipDidSchema = insertVoipDidSchema.partial()

export const voipDidSchemas = {
  insert: insertVoipDidSchema,
  update: updateVoipDidSchema,
}

export const voipDidServerSpec = {
  entityName: VOIP_DID,
  caslSubject: VOIP_DID,
  visibility: voipDidVisibility,
  table: voipDids,
  schemas: {
    insert: insertVoipDidSchema,
    update: updateVoipDidSchema,
    select: selectVoipDidSchema,
  },
} satisfies EntityServerSpec<typeof voipDids>
