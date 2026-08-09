/* eslint-disable no-console */
// ⚠️ CUTOVER-WINDOW-ONLY (like backfill-wave2-children before it): the blobs
// are the source of truth ONLY until the Wave-3 cutover release flips writers.
// After deploy, a full re-run would overwrite live column data with stale blob
// data. Post-deploy verification: --dry-run only (reports drift, writes nothing).
// Dies with the frozen blobs on the Wave-4 push (deprecation ledger).
//
// Usage:
//   pnpm tsx scripts/backfill-wave3-scalars.ts [--dry-run]
import './lib/load-env'
import process from 'node:process'
import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'
import { formMetaSectionSchema, fundingSectionSchema } from '@/shared/entities/proposals/schemas'
import { describeTargetDb } from './lib/describe-target-db'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const { env, host } = describeTargetDb()
  console.log(`[backfill-wave3-scalars] ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`DB target: ${env}`)
  console.log(`DB host:  ${host}`)

  const rows = await db.select({
    id: proposals.id,
    fundingJSON: proposals.fundingJSON,
    formMetaJSON: proposals.formMetaJSON,
    startingTcpCents: proposals.startingTcpCents,
    depositAmountCents: proposals.depositAmountCents,
    cashInDealCents: proposals.cashInDealCents,
    miscPriceCents: proposals.miscPriceCents,
    priceDisplayMode: proposals.priceDisplayMode,
    envelopeDocumentIds: proposals.envelopeDocumentIds,
  }).from(proposals)
    // Rows created after the writer flip have no blobs — nothing to backfill.
    .where(and(isNotNull(proposals.fundingJSON), isNotNull(proposals.formMetaJSON)))

  const failures: string[] = []
  let written = 0
  for (const row of rows) {
    const funding = fundingSectionSchema.safeParse(row.fundingJSON)
    const formMeta = formMetaSectionSchema.safeParse(row.formMetaJSON)
    if (!funding.success || !formMeta.success) {
      failures.push(`${row.id}: zod ${funding.success ? 'formMeta' : 'funding'} ${(funding.error ?? formMeta.error)?.message}`)
      continue
    }
    const f = funding.data.data
    const target = {
      startingTcpCents: Math.round(f.startingTcp * 100),
      depositAmountCents: Math.round(f.depositAmount * 100),
      cashInDealCents: Math.round(f.cashInDeal * 100),
      miscPriceCents: f.miscPrice == null ? null : Math.round(f.miscPrice * 100),
      priceDisplayMode: formMeta.data.pricingMode,
      envelopeDocumentIds: formMeta.data.envelopeDocumentIds ?? null,
    }
    try {
      if (!dryRun) {
        await db.update(proposals).set(target).where(eq(proposals.id, row.id))
        written++
      }
      // Parity: read back and field-diff against the blob-derived target.
      const [back] = await db.select({
        startingTcpCents: proposals.startingTcpCents,
        depositAmountCents: proposals.depositAmountCents,
        cashInDealCents: proposals.cashInDealCents,
        miscPriceCents: proposals.miscPriceCents,
        priceDisplayMode: proposals.priceDisplayMode,
        envelopeDocumentIds: proposals.envelopeDocumentIds,
      }).from(proposals).where(eq(proposals.id, row.id))
      const source = dryRun ? row : back
      for (const key of Object.keys(target) as (keyof typeof target)[]) {
        const a = JSON.stringify(source?.[key] ?? null)
        const b = JSON.stringify(target[key])
        if (!dryRun && a !== b) failures.push(`${row.id}: parity ${key} column=${a} blob=${b}`)
        if (dryRun && a !== b) console.log(`[dry-run] ${row.id}: would set ${key} ${a} → ${b}`)
      }
    }
    catch (err) {
      failures.push(`${row.id}: exception ${err instanceof Error ? err.message : err}`)
      console.error(`✗ proposals ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`${rows.length} proposals scanned, ${written} written, ${failures.length} failures`)
  if (failures.length > 0) {
    failures.forEach(f => console.error(`FAIL ${f}`))
    process.exit(1)
  }
}
main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
