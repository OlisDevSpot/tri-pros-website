/**
 * Read-only integration check of the construction-catalog seam against
 * production Notion (unlike the other verify-* scripts, which are pure).
 * Reads through `catalogSource`, never `service.ts` — `unstable_cache` needs a
 * Next request context.
 *
 * Usage: npx tsx scripts/verify-catalog-seam.ts
 */

import assert from 'node:assert/strict'
import process from 'node:process'
import './lib/load-env'
import { catalogSource } from '@/shared/modules/construction/sources'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function main() {
  const [trades, scopes] = await Promise.all([
    catalogSource.getTrades(),
    catalogSource.getScopes(),
  ])

  console.log(`trades: ${trades.length}  scopes: ${scopes.length}`)

  // V5 — P0 lifted the 100-row cap. P0 measured 120 scopes and 27 trades;
  // this asserts the magnitude, not the exact count, because the owner edits
  // Notion continuously.
  assert.ok(scopes.length > 100, `expected more than 100 scopes, got ${scopes.length}`)
  assert.ok(trades.length > 0, 'expected at least one trade')

  const tradeIds = new Set(trades.map(t => t.id))

  for (const trade of trades) {
    assert.ok(UUID.test(trade.id), `trade id is not a dashed lowercase UUID: ${trade.id}`)
    assert.ok(trade.slug.length > 0, `trade has no slug: ${trade.name}`)
  }

  let orphans = 0
  for (const scope of scopes) {
    assert.ok(UUID.test(scope.id), `scope id is not a dashed lowercase UUID: ${scope.id}`)
    assert.ok(scope.kind === 'scope' || scope.kind === 'addon', `scope.kind is neither 'scope' nor 'addon': ${scope.kind} (${scope.name})`)
    if (!tradeIds.has(scope.tradeId)) {
      orphans++
      console.warn(`  orphan scope: "${scope.name}" -> tradeId ${scope.tradeId} is not in this read`)
    }
  }

  // A scope whose trade is disabled is legitimately absent from `trades`, so
  // orphans are reported, not fatal. A large count means id normalization or
  // the disabled gate has regressed.
  assert.ok(orphans < scopes.length * 0.2, `${orphans} of ${scopes.length} scopes point at a trade that is not in the catalog`)

  console.log(`✓ catalog seam verified (${orphans} orphan scope(s), all ids normalized, all kinds valid)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
