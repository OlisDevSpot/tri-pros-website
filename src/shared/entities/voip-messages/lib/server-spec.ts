import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipMessageSchema, selectVoipMessageSchema, voipMessages } from '@/shared/db/schema'
import { VOIP_MESSAGE } from './constants'
import { voipMessageVisibility } from './visibility'

const updateVoipMessageSchema = insertVoipMessageSchema.partial()

export const voipMessageSchemas = {
  insert: insertVoipMessageSchema,
  update: updateVoipMessageSchema,
}

export const voipMessageServerSpec = {
  entityName: VOIP_MESSAGE,
  caslSubject: VOIP_MESSAGE,
  visibility: voipMessageVisibility,
  table: voipMessages,
  schemas: {
    insert: insertVoipMessageSchema,
    update: updateVoipMessageSchema,
    select: selectVoipMessageSchema,
  },
} satisfies EntityServerSpec<typeof voipMessages>
