/* eslint-disable no-console */
// Wave-2 backfill: leadMetaJSON → customer_lead_attribution + customer_enrichment;
// fundingJSON.data.incentives → proposal_incentives; final_tcp_cents recompute.
//
// ⚠️ CUTOVER-WINDOW-ONLY for the proposals section: it treats the BLOB as the
// source of truth. Once the cutover release flips writers (blob incentives
// blanked, rows canonical), a full re-run would overwrite live rows with stale
// blob data. Post-deploy verification MUST run with --skip-proposals; the
// proposals check becomes SQL (zero NULL final_tcp_cents) + flows. Delete this
// script when lead_meta_json drops — see docs/plans/jsonb-decomposition-deprecation-ledger.md.
//
// Idempotent PRE-cutover (upsert / delete-then-insert semantics) — re-run = verify/repair.
// Parity: read back and diff vs the source blob; TS computeFinalTcp pins the
// SQL recompute (Addendum A.2 guard). Non-zero diff or per-row Zod failure ⇒
// exit 1, no partial success reporting. see spec §4.
//
// DB target: DRIZZLE_TARGET=prod for cutover; default = dev/worktree.
// Deliberately the app's `@/shared/db` singleton, not a bespoke script-db
// client — safe since the VERCEL_ENV env-axes refactor (a local script can
// never trip the NODE_ENV-keyed production safety gates).
// see docs/codebase-conventions/environment.md#environment-axes
import process from 'node:process'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerEnrichment, customerLeadAttribution, customers, proposalIncentives, proposals } from '@/shared/db/schema'
import { LEGACY_ENRICHMENT_LABELS } from '@/shared/entities/customers/constants/funnel-intake-fields'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/financials'
import { fundingSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'
import { describeTargetDb } from './lib/describe-target-db'

const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_PROPOSALS = process.argv.includes('--skip-proposals')

interface Stats { written: number, wouldWrite: number, skipped: number, mismatches: number, errors: number }
const newStats = (): Stats => ({ written: 0, wouldWrite: 0, skipped: 0, mismatches: 0, errors: 0 })

// Order-independent structural equality for parity diffs. Postgres jsonb
// does NOT preserve object key insertion order on storage (unlike the
// `json` type) — a naive `JSON.stringify(a) !== JSON.stringify(b)` diff
// (Wave-1's `isEqualJson`) false-positives on any nested multi-key object
// column read back from the DB, e.g. captureJSON's `source`/`utm` keys.
// Confirmed empirically 2026-07-15: a read-back captureJSON that only
// differs in key order deep-equals the pre-write value. Arrays still
// compare by index — jsonb DOES preserve array element order.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b)
    return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
    return false
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const aKeys = Object.keys(aRecord).filter(k => aRecord[k] !== undefined)
  const bKeys = Object.keys(bRecord).filter(k => bRecord[k] !== undefined)
  if (aKeys.length !== bKeys.length)
    return false
  return aKeys.every(k => deepEqual(aRecord[k], bRecord[k]))
}

// Legacy flat enrichment (pre-refactor kitchen leads): Record<string, string>
// where key = dimension id, value = raw option id. Normalize to the canonical
// { label, value, order } shape before Zod parse (↷ logged, mirrors Wave-1).
function normalizeEnrichment(raw: unknown, rowId: string): Record<string, { label: string, value: string, order: number }> {
  if (!raw || typeof raw !== 'object')
    return {}
  const out: Record<string, { label: string, value: string, order: number }> = {}
  let i = 0
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'object' && v !== null && 'label' in v && 'value' in v) {
      const e = v as { label: string, value: string, order?: number }
      out[key] = { label: e.label, value: e.value, order: e.order ?? i }
    }
    else if (typeof v === 'string') {
      console.log(`  ↷ customers ${rowId}: legacy flat enrichment '${key}' normalized`)
      out[key] = { label: LEGACY_ENRICHMENT_LABELS[key] ?? key, value: v, order: i }
    }
    i++
  }
  return out
}

async function backfillCustomers(): Promise<Stats> {
  const stats = newStats()
  const rows = await db.select().from(customers)
  for (const row of rows) {
    try {
      const rawMeta = row.leadMetaJSONDeprecated // Wave-2 frozen blob — this backfill is its last reader
      if (!rawMeta) {
        stats.skipped++
        continue
      }

      const source = (rawMeta as { source?: Record<string, unknown> }).source
      const enrichment = normalizeEnrichment(source?.enrichment, row.id)
      // Zod gate on the normalized shape (parse failure → per-row error, exit 1)
      const meta = leadMetaSchema.parse(
        source ? { ...rawMeta, source: { ...source, enrichment: Object.keys(enrichment).length ? enrichment : undefined } } : rawMeta,
      )
      const funnel = meta.source?.kind === 'funnel' ? meta.source : null
      const capture = funnel ? { ...meta, source: { ...funnel, enrichment: undefined } } : meta
      const attribution = {
        kind: meta.source?.kind ?? ('generic' as const),
        funnelSlug: funnel?.funnelSlug ?? null,
        offer: funnel?.offer ?? null,
        utmSource: funnel?.utm.source ?? null,
        utmMedium: funnel?.utm.medium ?? null,
        utmCampaign: funnel?.utm.campaign ?? null,
        utmContent: funnel?.utm.content ?? null,
        utmTerm: funnel?.utm.term ?? null,
        captureJSON: capture,
      }
      const enrichmentRows = Object.entries(enrichment).map(([stepId, e]) => ({
        customerId: row.id,
        stepId,
        label: e.label,
        value: e.value,
        order: e.order,
      }))

      if (DRY_RUN) {
        stats.wouldWrite++
        continue
      }

      await db.insert(customerLeadAttribution)
        .values({ customerId: row.id, ...attribution })
        .onConflictDoUpdate({ target: customerLeadAttribution.customerId, set: attribution })
      for (const er of enrichmentRows) {
        await db.insert(customerEnrichment).values(er).onConflictDoUpdate({
          target: [customerEnrichment.customerId, customerEnrichment.stepId],
          set: { label: er.label, value: er.value, order: er.order },
        })
      }

      // Parity: read back, field-diff
      const diffs: string[] = []
      const [after] = await db.select().from(customerLeadAttribution).where(eq(customerLeadAttribution.customerId, row.id))
      if (!after) {
        diffs.push('attribution: expected row, found none')
      }
      else {
        for (const [k, v] of Object.entries(attribution)) {
          if (!deepEqual((after as Record<string, unknown>)[k] ?? null, v ?? null))
            diffs.push(`attribution.${k}`)
        }
      }
      const afterEnrichment = await db.select().from(customerEnrichment).where(eq(customerEnrichment.customerId, row.id))
      if (afterEnrichment.length < enrichmentRows.length)
        diffs.push(`enrichment: expected ≥${enrichmentRows.length} rows, found ${afterEnrichment.length}`)
      if (diffs.length > 0) {
        stats.mismatches++
        console.error(`✗ customers ${row.id}: parity diff on ${diffs.join(', ')}`)
      }
      else {
        stats.written++
      }
    }
    catch (err) {
      stats.errors++
      console.error(`✗ customers ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
  return stats
}

// Legacy proposals (pre-2026-06 `showPricingBreakdown` field) have
// funding.meta = { enabled } only. Default to `false` — the value every
// current creation path (create-proposal-popover, proposalFormShape
// defaults) writes for a fresh proposal (↷ logged, mirrors Wave-1).
function normalizeFundingMeta(raw: unknown, rowId: string): unknown {
  if (!raw || typeof raw !== 'object')
    return raw
  const funding = raw as { meta?: Record<string, unknown> }
  if (funding.meta && funding.meta.showPricingBreakdown === undefined) {
    console.log(`  ↷ proposals ${rowId}: legacy funding.meta missing 'showPricingBreakdown' → defaulted to false`)
    return { ...funding, meta: { ...funding.meta, showPricingBreakdown: false } }
  }
  return raw
}

// Legacy project sections (oldest proposal on record, 2026-02-26) predate
// several fields added since: the rich-text editor mirror (contentJSON),
// the trade-label denormalization, and the validThroughTimeframe selector.
// None of these feed computeFinalTcp (financials.incentives only) —
// placeholder/default values are safe for the parity read here (↷ logged,
// mirrors Wave-1; never silently skipped). Defaults match the values every
// current creation path writes for a fresh proposal (proposalFormShape
// defaults, schemas/index.ts).
function normalizeLegacyProject(raw: unknown, rowId: string): unknown {
  if (!raw || typeof raw !== 'object')
    return raw
  const project = raw as { data?: Record<string, unknown> & { sow?: Array<Record<string, unknown>> } }
  const data = project.data
  if (!data)
    return raw
  let touched = false
  const dataPatch: Record<string, unknown> = {}
  if (typeof data.validThroughTimeframe !== 'string') {
    dataPatch.validThroughTimeframe = '60 days'
    touched = true
    console.log(`  ↷ proposals ${rowId}: data missing 'validThroughTimeframe' → defaulted to '60 days'`)
  }
  const sow = data.sow
  if (Array.isArray(sow)) {
    const normalizedSow = sow.map((section, i) => {
      const patch: Record<string, unknown> = {}
      if (typeof section.contentJSON !== 'string') {
        patch.contentJSON = ''
        touched = true
        console.log(`  ↷ proposals ${rowId}: sow[${i}] missing 'contentJSON' → defaulted to ''`)
      }
      const trade = section.trade as { id?: string, label?: string } | undefined
      if (trade && typeof trade.label !== 'string') {
        patch.trade = { ...trade, label: '(legacy — label unknown)' }
        touched = true
        console.log(`  ↷ proposals ${rowId}: sow[${i}].trade missing 'label' → defaulted to placeholder`)
      }
      return Object.keys(patch).length ? { ...section, ...patch } : section
    })
    dataPatch.sow = normalizedSow
  }
  if (!touched)
    return raw
  return { ...project, data: { ...data, ...dataPatch } }
}

async function backfillProposals(): Promise<Stats> {
  const stats = newStats()
  const rows = await db.select().from(proposals)
  for (const row of rows) {
    try {
      const funding = fundingSectionSchema.parse(normalizeFundingMeta(row.fundingJSON, row.id))
      const project = projectSectionSchema.parse(normalizeLegacyProject(row.projectJSON, row.id))
      const incentiveRows = funding.data.incentives.map((inc, i) => ({
        proposalId: row.id,
        sowItemId: null,
        type: inc.type,
        position: i,
        label: null,
        amountCents: inc.type === 'discount' ? Math.round(inc.amount * 100) : null,
        offer: inc.type === 'exclusive-offer' ? inc.offer : null,
        notes: inc.notes ?? null,
        expiresAt: inc.expiresAt ?? null,
      }))

      if (DRY_RUN) {
        stats.wouldWrite++
        continue
      }

      // Idempotent replace of GLOBAL rows only (sow_item_id IS NULL)
      await db.delete(proposalIncentives).where(and(
        eq(proposalIncentives.proposalId, row.id),
        isNull(proposalIncentives.sowItemId),
      ))
      if (incentiveRows.length > 0)
        await db.insert(proposalIncentives).values(incentiveRows)

      // Rollup recompute — SAME statement recomputeProposalFinancials uses (keep in sync)
      await db.update(proposals).set({
        finalTcpCents: sql`GREATEST(0::numeric, (
          ROUND(COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0) * 100)
          - COALESCE((SELECT SUM(pi.amount_cents) FROM proposal_incentives pi
              WHERE pi.proposal_id = ${proposals.id} AND pi.type = 'discount'), 0)
          - COALESCE((SELECT ROUND(SUM((si->>'amount')::numeric) * 100)
              FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
                   jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si), 0)
        ))::bigint`,
      }).where(eq(proposals.id, row.id))

      // Parity: TS previewer pins the SQL recompute (Addendum A.2 guard a)
      const diffs: string[] = []
      const [after] = await db.select({ finalTcpCents: proposals.finalTcpCents }).from(proposals).where(eq(proposals.id, row.id))
      const expectedCents = Math.round(computeFinalTcp({ funding: funding.data, sow: project.data.sow }) * 100)
      if (after?.finalTcpCents !== expectedCents)
        diffs.push(`finalTcpCents: sql=${after?.finalTcpCents} ts=${expectedCents}`)
      const afterRows = await db.select().from(proposalIncentives)
        .where(and(eq(proposalIncentives.proposalId, row.id), isNull(proposalIncentives.sowItemId)))
      if (afterRows.length !== incentiveRows.length)
        diffs.push(`incentives: expected ${incentiveRows.length} rows, found ${afterRows.length}`)
      if (diffs.length > 0) {
        stats.mismatches++
        console.error(`✗ proposals ${row.id}: parity diff on ${diffs.join(', ')}`)
      }
      else {
        stats.written++
      }
    }
    catch (err) {
      stats.errors++
      console.error(`✗ proposals ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
  return stats
}

async function main() {
  const { env, host } = describeTargetDb()
  console.log(`[backfill-wave2] ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${SKIP_PROPOSALS ? ' (proposals SKIPPED — post-cutover mode)' : ''}`)
  console.log(`DB target: ${env}`)
  console.log(`DB host:  ${host}`)
  let failed = false
  const sections: Array<readonly [string, () => Promise<Stats>]> = [
    ['customers → attribution/enrichment', backfillCustomers],
  ]
  if (!SKIP_PROPOSALS)
    sections.push(['proposals → incentives/final_tcp_cents', backfillProposals])
  for (const [label, fn] of sections) {
    const s = await fn()
    console.log(`${label}: written=${s.written} wouldWrite=${s.wouldWrite} skipped=${s.skipped} mismatches=${s.mismatches} errors=${s.errors}`)
    if (s.mismatches > 0 || s.errors > 0)
      failed = true
  }
  if (failed) {
    console.error('BACKFILL FAILED — fix data or amend schema per spec §4; never silently skip.')
    process.exit(1)
  }
  process.exit(0)
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
