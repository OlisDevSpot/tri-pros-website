// voip-contact-fields business mutations — the dialer field-identity sync upsert.
// The campaign-sync service calls this; never reach for `db.insert/update`
// from a service layer.
//
// see ../../DOCS.md for invariants
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipContactField } from '@/shared/db/schema/voip-contact-fields'
import type { JustcallContactFieldAppKey } from '@/shared/services/providers/justcall/constants'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipContactFields } from '@/shared/db/schema/voip-contact-fields'

interface UpsertContactFieldByAppKeyInput {
  // Our stable key — the conflict target. Provider-side field ids may rotate;
  // the app_key is what the enrollment field-builder writes against.
  appKey: JustcallContactFieldAppKey
  providerFieldId: string
  providerFieldLabel: string
}

/**
 * Idempotent upsert keyed on the unique `app_key`. Called per-row by
 * `campaignSyncService.resyncDialer` after mapping each dialer custom-field
 * definition's label → our app_key. Refreshes the provider-assigned id + label
 * if the provider renamed or re-created the field.
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate` — do not set it.
 */
export async function upsertContactFieldByAppKey(
  input: UpsertContactFieldByAppKeyInput,
): Promise<DalReturn<VoipContactField>> {
  return dalDbOperation(async () => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(voipContactFields)
      .values({
        appKey: input.appKey,
        providerFieldId: input.providerFieldId,
        providerFieldLabel: input.providerFieldLabel,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: voipContactFields.appKey,
        set: {
          providerFieldId: input.providerFieldId,
          providerFieldLabel: input.providerFieldLabel,
          lastSyncedAt: now,
        },
      })
      .returning()

    return row!
  })
}
