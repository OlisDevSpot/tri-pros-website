import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipContactFieldSchema, selectVoipContactFieldSchema, voipContactFields } from '@/shared/db/schema'
import { VOIP_CONTACT_FIELD } from './constants'
import { voipContactFieldVisibility } from './visibility'

const updateVoipContactFieldSchema = insertVoipContactFieldSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipContactFieldSchemas = {
  insert: insertVoipContactFieldSchema,
  update: updateVoipContactFieldSchema,
}

export const voipContactFieldServerSpec = {
  entityName: VOIP_CONTACT_FIELD,
  caslSubject: VOIP_CONTACT_FIELD,
  visibility: voipContactFieldVisibility,
  table: voipContactFields,
  schemas: {
    insert: insertVoipContactFieldSchema,
    update: updateVoipContactFieldSchema,
    select: selectVoipContactFieldSchema,
  },
} satisfies EntityServerSpec<typeof voipContactFields>
