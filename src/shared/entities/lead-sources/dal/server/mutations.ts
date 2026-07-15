// lead-sources business mutations for voip-campaigns policy.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'

import { eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'

interface VoipCampaignsPolicyPatch {
  enabled?: boolean
  autoEnroll?: boolean
  // omit = leave unchanged; null = clear the default; uuid = set it.
  defaultCampaignId?: string | null
}

/**
 * Patch a lead source's campaigns policy (epic #256/#259: plain columns, not
 * a JSONB blob). Single UPDATE over disjoint columns — no read-modify-write,
 * so concurrent toggles can no longer race each other. Only the provided
 * fields change; omitted fields are left untouched. No-op when the source is
 * missing or the patch is empty.
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate`.
 */
export async function setVoipCampaignsPolicy(
  sourceSlug: string,
  patch: VoipCampaignsPolicyPatch,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const set: Partial<typeof leadSourcesTable.$inferInsert> = {}
    if (patch.enabled !== undefined)
      set.voipCampaignsEnabled = patch.enabled
    if (patch.autoEnroll !== undefined)
      set.voipAutoEnroll = patch.autoEnroll
    if (patch.defaultCampaignId !== undefined)
      set.defaultCampaignId = patch.defaultCampaignId
    if (Object.keys(set).length === 0)
      return { rowsAffected: 0 }

    const result = await db
      .update(leadSourcesTable)
      .set(set)
      .where(eq(leadSourcesTable.slug, sourceSlug))
      .returning({ id: leadSourcesTable.id })
    return { rowsAffected: result.length }
  })
}
