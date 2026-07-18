/* eslint-disable no-console */
// Rebuild script for the `final_tcp_cents` cache column — leg (d) of the
// four-leg cache-column discipline (docs/codebase-conventions/derived-values.md):
// chokepoint + pure function + REBUILD SCRIPT + calc_version.
//
// Detection is a read-only SELECT using the SAME expression as
// recomputeProposalFinancials (keep in sync — see
// src/shared/entities/proposals/dal/server/mutations.ts). Writes go ONLY
// through recomputeProposalFinancials itself, so the chokepoint stays the
// single writer. Idempotent: re-run = verify/repair, always converges.
//
// Usage:
//   pnpm tsx scripts/recompute-final-tcp.ts --dry-run   # report drift only
//   pnpm tsx scripts/recompute-final-tcp.ts             # repair drifted rows
//   DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts ...  # prod
import process from 'node:process'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { recomputeProposalFinancials } from '@/shared/entities/proposals/dal/server/mutations'
import { describeTargetDb } from './lib/describe-target-db'

const DRY_RUN = process.argv.includes('--dry-run')

interface DriftRow { id: string, stored: string | null, computed: string }

async function findDrift(): Promise<DriftRow[]> {
  // Same expression as recomputeProposalFinancials — keep in sync.
  const result = await db.execute(sql`
    SELECT id::text AS id,
           final_tcp_cents::text AS stored,
           (GREATEST(0::numeric, (
             ROUND(COALESCE(("funding_JSON"->'data'->>'startingTcp')::numeric, 0) * 100)
             - COALESCE((SELECT SUM(pi.amount_cents) FROM proposal_incentives pi
                 WHERE pi.proposal_id = proposals.id AND pi.type = 'discount'), 0)
             - COALESCE((SELECT ROUND(SUM((si->>'amount')::numeric) * 100)
                 FROM jsonb_array_elements("project_JSON"->'data'->'sow') AS sec,
                      jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si), 0)
           ))::bigint)::text AS computed
    FROM proposals
  `)
  const rows = result.rows as unknown as DriftRow[]
  return rows.filter(r => r.stored !== r.computed)
}

async function main() {
  const { env, host } = describeTargetDb()
  console.log(`[recompute-final-tcp] ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`DB target: ${env}`)
  console.log(`DB host:  ${host}`)

  const drifted = await findDrift()
  if (drifted.length === 0) {
    console.log('✓ zero drift — final_tcp_cents converged on every proposal')
    process.exit(0)
  }

  for (const row of drifted) {
    console.log(`  drift: proposal ${row.id} stored=${row.stored ?? 'NULL'} computed=${row.computed}`)
  }
  console.log(`${drifted.length} drifted row(s)`)

  if (DRY_RUN) {
    // Drift found in dry-run is a finding, not a failure of THIS script —
    // exit non-zero so CI/runbooks notice.
    process.exit(1)
  }

  for (const row of drifted) {
    dalVerifySuccess(await recomputeProposalFinancials(row.id))
  }

  const remaining = await findDrift()
  if (remaining.length > 0) {
    console.error(`✗ REBUILD FAILED — ${remaining.length} row(s) still drifted after recompute`)
    process.exit(1)
  }
  console.log(`✓ repaired ${drifted.length} row(s) via recomputeProposalFinancials — zero drift`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
