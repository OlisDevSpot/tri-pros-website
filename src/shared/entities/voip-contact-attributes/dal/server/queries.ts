// Business queries for the voip-contact-attributes entity.
// see ../../DOCS.md for business rules.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipContactAttribute } from '@/shared/db/schema/voip-contact-attributes'

import { asc } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipContactAttributes } from '@/shared/db/schema/voip-contact-attributes'

/**
 * All synced attribute bridges. Used by enrollment to map app_key → ct_attribute_id
 * when building contact-attribute writes, and by the Resync admin UI.
 */
export async function listVoipContactAttributes(): Promise<DalReturn<VoipContactAttribute[]>> {
  return dalDbOperation(async () => {
    return db
      .select()
      .from(voipContactAttributes)
      .orderBy(asc(voipContactAttributes.appKey))
  })
}
