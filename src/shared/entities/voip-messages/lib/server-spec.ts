import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipMessageSchema, selectVoipMessageSchema, voipMessages } from '@/shared/db/schema'
import { VOIP_MESSAGE } from './constants'

const updateVoipMessageSchema = insertVoipMessageSchema.partial()

export const voipMessageSchemas = {
  insert: insertVoipMessageSchema,
  update: updateVoipMessageSchema,
}

export const voipMessageServerSpec = {
  entityName: VOIP_MESSAGE,
  caslSubject: VOIP_MESSAGE,
  table: voipMessages,
  schemas: {
    insert: insertVoipMessageSchema,
    update: updateVoipMessageSchema,
    select: selectVoipMessageSchema,
  },
} satisfies EntityServerSpec<typeof voipMessages>
