import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipContactAttributeSchema, selectVoipContactAttributeSchema, voipContactAttributes } from '@/shared/db/schema'
import { VOIP_CONTACT_ATTRIBUTE } from './constants'

const updateVoipContactAttributeSchema = insertVoipContactAttributeSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const voipContactAttributeSchemas = {
  insert: insertVoipContactAttributeSchema,
  update: updateVoipContactAttributeSchema,
}

export const voipContactAttributeServerSpec = {
  entityName: VOIP_CONTACT_ATTRIBUTE,
  caslSubject: VOIP_CONTACT_ATTRIBUTE,
  table: voipContactAttributes,
  schemas: {
    insert: insertVoipContactAttributeSchema,
    update: updateVoipContactAttributeSchema,
    select: selectVoipContactAttributeSchema,
  },
} satisfies EntityServerSpec<typeof voipContactAttributes>
