/* eslint-disable no-console */
// One-time backfill: re-optimize stuck proposal media (Sub-plan 2.1).
//
// Proposal images/PDFs whose optimize job never completed (dev-without-tunnel,
// a transient QStash/R2 error → 'failed', or rows predating the generic-dispatch
// refactor) sit at optimizationStatus <> 'optimized' with no responsive variants.
// This re-runs the SYNCHRONOUS optimizer (mediaService.optimizeNow → optimizeMediaFile)
// per row — no QStash callback, so it works from a plain operator machine.
//
// Idempotent: the orchestrator skips rows already 'optimized' and sets
// 'processing' → 'optimized'/'failed' itself. Re-run = verify/repair.
//
// DB target: DRIZZLE_TARGET=prod for prod; default = dev/worktree. Deliberately
// the app's `@/shared/db` singleton (self-resolves DRIZZLE_TARGET, self-loads
// .env.local) — sharing it with the optimizer guarantees the SELECT and the
// optimize step hit ONE database. NOT a hand-rolled connection, NOT load-env.
// see docs/codebase-conventions/environment.md#environment-axes
import process from 'node:process'
import { and, eq, isNotNull, like, ne, or } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema'
import { mediaService } from '@/shared/services/media/media.service'
import { proposalMediaStore } from '@/shared/services/media/stores'
import { describeTargetDb } from './lib/describe-target-db'

const DRY_RUN = process.argv.includes('--dry-run')

async function selectStuck() {
  return db
    .select({ id: proposalMediaFiles.id, optimizationStatus: proposalMediaFiles.optimizationStatus })
    .from(proposalMediaFiles)
    .where(and(
      or(like(proposalMediaFiles.mimeType, 'image/%'), eq(proposalMediaFiles.mimeType, 'application/pdf')),
      ne(proposalMediaFiles.optimizationStatus, 'optimized'),
      isNotNull(proposalMediaFiles.pathKey),
      isNotNull(proposalMediaFiles.bucket),
    ))
}

async function main() {
  const { env, host } = describeTargetDb()
  console.log(`[backfill-proposal-media-optimization] ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`DB target: ${env}`)
  console.log(`DB host:  ${host}`)

  const stuck = await selectStuck()

  if (DRY_RUN) {
    const byStatus = stuck.reduce<Record<string, number>>((acc, r) => {
      acc[r.optimizationStatus] = (acc[r.optimizationStatus] ?? 0) + 1
      return acc
    }, {})
    console.log(`stuck rows: ${stuck.length}`)
    for (const [status, count] of Object.entries(byStatus))
      console.log(`  ${status}: ${count}`)
    process.exit(0)
  }

  let optimized = 0
  let failed = 0
  for (const row of stuck) {
    try {
      await mediaService.optimizeNow(proposalMediaStore, row.id)
      optimized++
    }
    catch (err) {
      failed++
      console.error(`✗ proposal media ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`done: optimized=${optimized} failed=${failed} (of ${stuck.length})`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
