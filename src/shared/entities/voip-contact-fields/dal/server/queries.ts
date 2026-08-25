// Business queries for the voip-contact-fields entity.
// see ../../DOCS.md for business rules.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipContactField } from '@/shared/db/schema/voip-contact-fields'

import { asc } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipContactFields } from '@/shared/db/schema/voip-contact-fields'

/**
 * All synced dialer custom-field bridges. Used by enrollment to map app_key →
 * provider_field_id when building the dialer `custom_fields` payload, and by the
 * Resync admin UI.
 */
export async function listVoipContactFields(): Promise<DalReturn<VoipContactField[]>> {
  return dalDbOperation(async () => {
    return db
      .select()
      .from(voipContactFields)
      .orderBy(asc(voipContactFields.appKey))
  })
}
