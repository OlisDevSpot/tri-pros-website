// Business queries for the voip-campaigns entity. Custom lookups beyond CRUD.
// see ../../DOCS.md for business rules.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'

import { asc, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'

/** All synced campaigns (bound + unbound). Used by the Resync/binding admin UI. */
export async function listVoipCampaigns(): Promise<DalReturn<VoipCampaign[]>> {
  return dalDbOperation(async () => {
    return db
      .select()
      .from(voipCampaigns)
      .orderBy(asc(voipCampaigns.ctCampaignName))
  })
}

/** A single campaign by its app-side id. Used by enrollment to read the membership tag. */
export async function getVoipCampaignById(id: string): Promise<DalReturn<VoipCampaign | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(voipCampaigns)
      .where(eq(voipCampaigns.id, id))
      .limit(1)
    return row ?? null
  })
}
