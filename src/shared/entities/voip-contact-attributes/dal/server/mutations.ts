// voip-contact-attributes business mutations — the CT-identity sync upsert.
// The campaign-sync service calls this; never reach for `db.insert/update`
// from a service layer.
//
// see ../../DOCS.md for invariants
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipContactAttribute } from '@/shared/db/schema/voip-contact-attributes'
import type { CloudtalkContactAttributeAppKey } from '@/shared/services/providers/cloudtalk/constants'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipContactAttributes } from '@/shared/db/schema/voip-contact-attributes'

interface UpsertAttributeByAppKeyInput {
  // Our stable key — the conflict target. CT-side ids may rotate; the app_key
  // is what the enrollment attribute-builder writes against.
  appKey: CloudtalkContactAttributeAppKey
  ctAttributeId: string
  ctTitle: string
}

/**
 * Idempotent upsert keyed on the unique `app_key`. Called per-row by
 * `campaign-sync.service.resyncFromCloudtalk` after mapping each CT attribute
 * definition's title → our app_key. Refreshes the CT-assigned id + title if CT
 * renamed or re-created the attribute.
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate` — do not set it.
 */
export async function upsertAttributeByAppKey(
  input: UpsertAttributeByAppKeyInput,
): Promise<DalReturn<VoipContactAttribute>> {
  return dalDbOperation(async () => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(voipContactAttributes)
      .values({
        appKey: input.appKey,
        ctAttributeId: input.ctAttributeId,
        ctTitle: input.ctTitle,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: voipContactAttributes.appKey,
        set: {
          ctAttributeId: input.ctAttributeId,
          ctTitle: input.ctTitle,
          lastSyncedAt: now,
        },
      })
      .returning()

    return row!
  })
}
