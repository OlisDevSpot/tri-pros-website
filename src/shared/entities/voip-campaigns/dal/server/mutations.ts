// voip-campaigns business mutations — the dialer-identity sync upsert that
// doesn't fit generic CRUD. The campaign-sync service calls this; never reach
// for `db.insert/update` from a service layer.
//
// see ../../DOCS.md for invariants
// see docs/codebase-conventions/dal-conventions.md
// see memory/feedback-services-orchestrate-dal-implements.md

import type { DialerMode } from '@/shared/constants/enums/voip'
import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'

interface UpsertCampaignByProviderIdInput {
  // Provider-assigned campaign ID — the stable natural key the sync upserts on.
  providerCampaignId: string
  providerCampaignName: string
  status: 'active' | 'inactive'
  dialerMode: DialerMode
  attemptsPerContact?: number
  hoursBetweenAttempts?: number
}

/**
 * Idempotent upsert keyed on the unique `provider_campaign_id`. Called per-row by
 * `campaignSyncService.resyncDialer`. Refreshes dialer identity (name / status /
 * mode / cadence) only — campaigns are pools, not source-owned (the `source_slug`
 * ownership column was removed 2026-06-11; see ../../DOCS.md#admin-binding).
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate` — do not set it.
 */
export async function upsertCampaignByProviderId(
  input: UpsertCampaignByProviderIdInput,
): Promise<DalReturn<VoipCampaign>> {
  return dalDbOperation(async () => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(voipCampaigns)
      .values({
        providerCampaignId: input.providerCampaignId,
        providerCampaignName: input.providerCampaignName,
        status: input.status,
        dialerMode: input.dialerMode,
        attemptsPerContact: input.attemptsPerContact ?? 10,
        hoursBetweenAttempts: input.hoursBetweenAttempts ?? 3,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: voipCampaigns.providerCampaignId,
        set: {
          providerCampaignName: input.providerCampaignName,
          status: input.status,
          dialerMode: input.dialerMode,
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
