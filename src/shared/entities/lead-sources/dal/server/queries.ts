// Business queries for the lead-sources entity.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { LeadSourceRecord } from '@/shared/db/schema/lead-sources'

import { asc, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'

/** Resolve a lead source by id. Used by enrollment to read slug + voipConfigJSON policy. */
export async function getLeadSourceById(id: string): Promise<DalReturn<LeadSourceRecord | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.id, id))
      .limit(1)
    return (row ?? null) as LeadSourceRecord | null
  })
}

/**
 * Lightweight list of all lead sources (no analytics). Used by the Campaigns
 * Control Center left rail + binding selects. Ordered by name.
 */
export async function listLeadSources(): Promise<DalReturn<LeadSourceRecord[]>> {
  return dalDbOperation(async () => {
    return await db
      .select()
      .from(leadSourcesTable)
      .orderBy(asc(leadSourcesTable.name)) as LeadSourceRecord[]
  })
}

/** Resolve a lead source by slug. Used by the bulk enroll-all job (source-keyed). */
export async function getLeadSourceBySlug(slug: string): Promise<DalReturn<LeadSourceRecord | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, slug))
      .limit(1)
    return (row ?? null) as LeadSourceRecord | null
  })
}
