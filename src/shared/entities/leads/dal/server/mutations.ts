import type { LeadStepTimelineEntry } from '@/shared/db/schema'
import type { FunnelUtm } from '@/shared/domains/funnels/types'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { insertLeadSchema, leads } from '@/shared/db/schema'

// Current schema version for every lead jsonb blob. Bump on any breaking shape
// change. see docs/codebase-conventions/jsonb-columns.md#mandatory-schema-version
const LEAD_BLOB_V = 1

export interface CreateDraftLeadInput {
  funnelSlug: string
  trade: string | null
  answers: Record<string, unknown>
  firstEntry: LeadStepTimelineEntry
  fbclid: string | null
  fbp: string | null
  utm: FunnelUtm | null
  clientIp: string | null
  clientUserAgent: string | null
}

export async function createDraftLead(input: CreateDraftLeadInput): Promise<{ id: string }> {
  const values = insertLeadSchema.parse({
    funnelSlug: input.funnelSlug,
    trade: input.trade,
    answersJSON: { _v: LEAD_BLOB_V, ...input.answers },
    stepTimelineJSON: { _v: LEAD_BLOB_V, entries: [input.firstEntry] },
    fbclid: input.fbclid,
    fbp: input.fbp,
    utmJSON: input.utm ? { _v: LEAD_BLOB_V, ...input.utm } : null,
    clientIp: input.clientIp,
    clientUserAgent: input.clientUserAgent,
  })
  const [row] = await db.insert(leads).values(values).returning({ id: leads.id })
  return { id: row.id }
}

/**
 * Full-value write: caller supplies the complete answers map; the timeline
 * entry is appended to the freshly-read array. Single-writer per session (the
 * visitor's own browser), so read-modify-write is race-safe in practice.
 * Never a shallow jsonb merge. see docs/codebase-conventions/jsonb-columns.md
 */
export async function appendDraftStep(
  id: string,
  input: { answers: Record<string, unknown>, entry: LeadStepTimelineEntry },
): Promise<boolean> {
  const [current] = await db
    .select({ stepTimelineJSON: leads.stepTimelineJSON })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1)
  if (!current) {
    return false
  }
  await db
    .update(leads)
    .set({
      answersJSON: { _v: LEAD_BLOB_V, ...input.answers },
      stepTimelineJSON: { _v: LEAD_BLOB_V, entries: [...current.stepTimelineJSON.entries, input.entry] },
    })
    .where(eq(leads.id, id))
  return true
}

export async function setMetaLeadEventId(id: string, metaLeadEventId: string): Promise<void> {
  await db.update(leads).set({ metaLeadEventId }).where(eq(leads.id, id))
}
