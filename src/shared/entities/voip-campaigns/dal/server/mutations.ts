// voip-campaigns business mutations — the CT-identity sync upsert that doesn't
// fit generic CRUD. The campaign-sync service calls this; never reach for
// `db.insert/update` from a service layer.
//
// see ../../DOCS.md for invariants
// see docs/codebase-conventions/dal-conventions.md
// see memory/feedback-services-orchestrate-dal-implements.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'

interface UpsertCampaignByCtIdInput {
  // CT-assigned campaign ID — the stable natural key the sync upserts on.
  ctCampaignId: string
  ctCampaignName: string
  ctMembershipTag: string
  ctTagId?: string | null
  ctStatus: string
  attemptsPerContact?: number
  hoursBetweenAttempts?: number
}

/**
 * Idempotent upsert keyed on the unique `ct_campaign_id`. Called per-row by
 * `campaign-sync.service.resyncFromCloudtalk`. Refreshes CT identity (name / tag
 * / status / cadence) only — campaigns are pools, not source-owned (the
 * `source_slug` ownership column was removed 2026-06-11; see ../../DOCS.md#admin-binding).
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate` — do not set it.
 */
export async function upsertCampaignByCtId(
  input: UpsertCampaignByCtIdInput,
): Promise<DalReturn<VoipCampaign>> {
  return dalDbOperation(async () => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(voipCampaigns)
      .values({
        ctCampaignId: input.ctCampaignId,
        ctCampaignName: input.ctCampaignName,
        ctMembershipTag: input.ctMembershipTag,
        ctTagId: input.ctTagId ?? null,
        ctStatus: input.ctStatus,
        attemptsPerContact: input.attemptsPerContact ?? 10,
        hoursBetweenAttempts: input.hoursBetweenAttempts ?? 3,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: voipCampaigns.ctCampaignId,
        set: {
          ctCampaignName: input.ctCampaignName,
          ctMembershipTag: input.ctMembershipTag,
          ctTagId: input.ctTagId ?? null,
          ctStatus: input.ctStatus,
          attemptsPerContact: input.attemptsPerContact ?? 10,
          hoursBetweenAttempts: input.hoursBetweenAttempts ?? 3,
          lastSyncedAt: now,
          // NOTE: source_slug intentionally omitted — admin binding is preserved.
        },
      })
      .returning()

    return row!
  })
}
