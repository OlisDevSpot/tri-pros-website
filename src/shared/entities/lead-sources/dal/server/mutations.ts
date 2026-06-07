// lead-sources business mutations for voip-campaigns policy.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipConfig } from '@/shared/entities/lead-sources/schemas'

import { eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'

/**
 * Set (or clear) a lead source's default CloudTalk campaign for AUTO-enroll
 * (EPIC decision #10). Read-modify-write merge into `voip_config_json.campaigns`
 * so the other policy fields (`enabled`, `autoEnroll`, caps) are preserved.
 * Pass `campaignId = null` to clear the default. No-op when the source is missing.
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate`.
 */
export async function setVoipDefaultCampaign(
  sourceSlug: string,
  campaignId: string | null,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const [current] = await db
      .select({ voipConfigJSON: leadSourcesTable.voipConfigJSON })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, sourceSlug))
      .limit(1)
    if (!current) {
      return { rowsAffected: 0 }
    }

    const existing: VoipConfig = current.voipConfigJSON ?? {}
    const nextConfig: VoipConfig = {
      ...existing,
      campaigns: {
        // Sensible defaults so a never-configured source still validates.
        enabled: existing.campaigns?.enabled ?? true,
        autoEnroll: existing.campaigns?.autoEnroll ?? false,
        ...existing.campaigns,
        defaultCampaignId: campaignId ?? undefined,
      },
    }

    const result = await db
      .update(leadSourcesTable)
      .set({ voipConfigJSON: nextConfig })
      .where(eq(leadSourcesTable.slug, sourceSlug))
      .returning({ id: leadSourcesTable.id })

    return { rowsAffected: result.length }
  })
}
