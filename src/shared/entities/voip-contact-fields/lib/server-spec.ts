import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipContactFieldSchema, selectVoipContactFieldSchema, voipContactFields } from '@/shared/db/schema'
import { VOIP_CONTACT_FIELD } from './constants'
import { voipContactFieldVisibility } from './visibility'

const updateVoipContactFieldSchema = insertVoipContactFieldSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipContactFieldSchemas = {
  insert: insertVoipContactFieldSchema,
  update: updateVoipContactFieldSchema,
}

export const voipContactFieldServerSpec = defineEntitySpec({
  entityName: VOIP_CONTACT_FIELD,
  subject: VOIP_CONTACT_FIELD,
  conditionColumns: [],
  visibility: voipContactFieldVisibility,
  table: voipContactFields,
  schemas: {
    insert: insertVoipContactFieldSchema,
    update: updateVoipContactFieldSchema,
    select: selectVoipContactFieldSchema,
  },
})
