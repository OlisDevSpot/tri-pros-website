import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

// ---------------------------------------------------------------------------
// campaignSyncService — mirrors CloudTalk's campaign + attribute identity into
// our DB so enrollment can resolve membership tags + attribute ids without
// hardcoding CT-assigned ids (EPIC decisions #8 + 2026-05-31).
//
// PURE ORCHESTRATION. Composes:
//   - cloudtalkClient (provider: listCampaigns + listContactAttributes)
//   - voip-campaigns DAL mutation (upsertCampaignByCtId)
//   - voip-contact-attributes DAL mutation (upsertAttributeByAppKey)
//   - lib/ pure mapper (attribute title → app_key)
//
// No raw db. Campaigns sync UNBOUND (source_slug NULL) — an admin binds each to
// a lead source via the Resync UI afterwards (decision #8). We never parse CT
// campaign names to infer the source.
//
// see docs/codebase-conventions/service-architecture.md
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-06-04
// ---------------------------------------------------------------------------

import { dalSuccess } from '@/shared/dal/server/types'
import { upsertCampaignByCtId } from '@/shared/entities/voip-campaigns/dal/server/mutations'
import { upsertAttributeByAppKey } from '@/shared/entities/voip-contact-attributes/dal/server/mutations'
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'

import { mapAttributeTitleToAppKey } from './lib/attribute-title-map'

// Why a CT campaign didn't make it into voip_campaigns. 'no_membership_tag' is
// the actionable one — the admin must configure a contact-list tag on the
// campaign in CloudTalk before our tag-driven enrollment can target it.
export type SkippedCampaignReason = 'no_membership_tag' | 'upsert_failed'

export interface SkippedCampaign {
  ctCampaignId: string
  name: string
  reason: SkippedCampaignReason
}

export interface ResyncResult {
  campaignsSynced: number
  campaignsSkipped: number // = skippedCampaigns.length
  // Named + reasoned so the admin UI can explain "synced 2 of 3" instead of
  // silently dropping the third. Surfaced in the resync toast.
  skippedCampaigns: SkippedCampaign[]
  attributesSynced: number
  attributesSkipped: number // title not one of our 3 app keys
}

function createCampaignSyncService() {
  return {
    /**
     * Pull CT campaigns + attribute definitions and upsert the identity bridges.
     * Idempotent. Preserves admin source bindings (upsert omits source_slug).
     * Returns counts for the admin toast.
     */
    async resyncFromCloudtalk(_ctx: ScopedContext): Promise<DalReturn<ResyncResult>> {
      let campaignsSynced = 0
      const skippedCampaigns: SkippedCampaign[] = []
      let attributesSynced = 0
      let attributesSkipped = 0

      // ── Campaigns ──────────────────────────────────────────────────────
      const campaigns = await cloudtalkClient.listCampaigns()
      for (const row of campaigns) {
        const membershipTag = row.membershipTagName
        if (!membershipTag) {
          // No tag configured in CT → can't be an enrollment target. Skip, but
          // record it so the admin sees WHY it didn't sync (and how to fix it).
          skippedCampaigns.push({
            ctCampaignId: row.campaign.id,
            name: row.campaign.name,
            reason: 'no_membership_tag',
          })
          console.warn('[campaign-sync] campaign has no membership tag — skipped', {
            ctCampaignId: row.campaign.id,
            ctCampaignName: row.campaign.name,
          })
          continue
        }
        const result = await upsertCampaignByCtId({
          ctCampaignId: row.campaign.id,
          ctCampaignName: row.campaign.name,
          ctMembershipTag: membershipTag,
          ctStatus: row.campaign.status ?? 'inactive',
        })
        if (result.success) {
          campaignsSynced++
        }
        else {
          skippedCampaigns.push({
            ctCampaignId: row.campaign.id,
            name: row.campaign.name,
            reason: 'upsert_failed',
          })
          console.error('[campaign-sync] campaign upsert failed', {
            ctCampaignId: row.campaign.id,
            error: result.error,
          })
        }
      }

      // ── Contact attributes ─────────────────────────────────────────────
      const attributes = await cloudtalkClient.listContactAttributes()
      for (const def of attributes) {
        const appKey = mapAttributeTitleToAppKey(def.title)
        if (!appKey) {
          attributesSkipped++
          continue
        }
        const result = await upsertAttributeByAppKey({
          appKey,
          ctAttributeId: def.id,
          ctTitle: def.title,
        })
        if (result.success) {
          attributesSynced++
        }
        else {
          attributesSkipped++
          console.error('[campaign-sync] attribute upsert failed', {
            ctAttributeId: def.id,
            error: result.error,
          })
        }
      }

      return dalSuccess({
        campaignsSynced,
        campaignsSkipped: skippedCampaigns.length,
        skippedCampaigns,
        attributesSynced,
        attributesSkipped,
      })
    },
  }
}

export const campaignSyncService = createCampaignSyncService()
