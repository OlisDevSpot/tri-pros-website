import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

// ---------------------------------------------------------------------------
// campaignSyncService — mirrors the dialer's (JustCall) campaigns + custom-field
// definitions into our DB so enrollment can resolve campaign ids + field ids
// without hardcoding provider-assigned ids (EPIC decisions #8 + 2026-05-31).
//
// PURE ORCHESTRATION. Composes:
//   - dialerProvider (neutral seam: listCampaigns + listContactFields)
//   - voip-campaigns DAL mutation (upsertCampaignByProviderId)
//   - voip-contact-fields DAL mutation (upsertContactFieldByAppKey)
//   - lib/ pure mapper (field label → app_key)
//
// No raw db. Campaigns sync with their dialer_mode + status; an admin binds each
// to a lead source via the Resync UI afterwards (decision #8). We never parse
// campaign names to infer the source.
//
// see docs/codebase-conventions/service-architecture.md
// see docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md
// ---------------------------------------------------------------------------

import { dalSuccess } from '@/shared/dal/server/types'
import { upsertCampaignByProviderId } from '@/shared/entities/voip-campaigns/dal/server/mutations'
import { upsertContactFieldByAppKey } from '@/shared/entities/voip-contact-fields/dal/server/mutations'
import { dialerProvider } from '@/shared/services/voip/dialer'

import { mapFieldLabelToAppKey } from './lib/field-label-map'

// Why a dialer campaign didn't make it into voip_campaigns. JustCall has no
// membership-tag requirement (enrollment is an explicit campaign push), so the
// only skip reason left is an upsert failure.
export type SkippedCampaignReason = 'upsert_failed'

export interface SkippedCampaign {
  providerCampaignId: string
  name: string
  reason: SkippedCampaignReason
}

export interface ResyncResult {
  campaignsSynced: number
  campaignsSkipped: number // = skippedCampaigns.length
  // Named + reasoned so the admin UI can explain "synced 2 of 3" instead of
  // silently dropping the third. Surfaced in the resync toast.
  skippedCampaigns: SkippedCampaign[]
  fieldsSynced: number
  fieldsSkipped: number // label not one of our 4 app keys
}

function createCampaignSyncService() {
  return {
    /**
     * Pull dialer campaigns + custom-field definitions and upsert the identity
     * bridges. Idempotent. Preserves admin source bindings (upsert omits
     * source_slug). Returns counts for the admin toast.
     */
    async resyncDialer(_ctx: ScopedContext): Promise<DalReturn<ResyncResult>> {
      let campaignsSynced = 0
      const skippedCampaigns: SkippedCampaign[] = []
      let fieldsSynced = 0
      let fieldsSkipped = 0

      // ── Campaigns ──────────────────────────────────────────────────────
      const campaigns = await dialerProvider.listCampaigns()
      for (const c of campaigns) {
        const result = await upsertCampaignByProviderId({
          providerCampaignId: c.providerCampaignId,
          providerCampaignName: c.name,
          status: c.status,
          dialerMode: c.dialerMode,
        })
        if (result.success) {
          campaignsSynced++
        }
        else {
          skippedCampaigns.push({
            providerCampaignId: c.providerCampaignId,
            name: c.name,
            reason: 'upsert_failed',
          })
          console.error('[campaign-sync] campaign upsert failed', {
            providerCampaignId: c.providerCampaignId,
            error: result.error,
          })
        }
      }

      // ── Custom fields ──────────────────────────────────────────────────
      const fields = await dialerProvider.listContactFields()
      for (const f of fields) {
        const label = f.label ?? f.appKey
        const appKey = mapFieldLabelToAppKey(label)
        if (!appKey || !f.providerFieldId) {
          fieldsSkipped++
          continue
        }
        const result = await upsertContactFieldByAppKey({
          appKey,
          providerFieldId: f.providerFieldId,
          providerFieldLabel: label,
        })
        if (result.success) {
          fieldsSynced++
        }
        else {
          fieldsSkipped++
          console.error('[campaign-sync] field upsert failed', {
            providerFieldId: f.providerFieldId,
            error: result.error,
          })
        }
      }

      return dalSuccess({
        campaignsSynced,
        campaignsSkipped: skippedCampaigns.length,
        skippedCampaigns,
        fieldsSynced,
        fieldsSkipped,
      })
    },
  }
}

export const campaignSyncService = createCampaignSyncService()
