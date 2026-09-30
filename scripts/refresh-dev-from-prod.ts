import process from 'node:process'
import { Pool } from 'pg'

import { createNeonClient } from './lib/neon-api'
import { childrenOf, endpointIdFromUrl, resolveTarget, SCRUB_STATEMENTS } from './lib/neon-refresh'

/**
 * Refresh the dev database from its Neon parent.
 *
 *   pnpm db:refresh:dev             # reset + scrub
 *   pnpm db:refresh:dev --dry-run   # print the plan, touch nothing
 *
 * Neon resets the branch behind DATABASE_DEV_URL to its parent's head
 * (copy-on-write, seconds, identical data + schema + sequences, no load on
 * prod), then SCRUB_STATEMENTS run in one transaction on the reset branch.
 *
 * The target follows the connection string:
 *   on main         DATABASE_DEV_URL → development   ← production
 *   in a worktree   DATABASE_DEV_URL → wt/issue-N    ← development
 *
 * Prod is never written: DATABASE_URL is read only to compare endpoint ids.
 * After a reset the branch carries the parent's schema, so run
 * `pnpm db:push:dev` if local code has schema changes the parent lacks.
 */
import './lib/load-env'

const DRY_RUN = process.argv.includes('--dry-run')

function fail(message: string): never {
  console.error('')
  console.error(`  ${message}`)
  console.error('')
  process.exit(1)
}

async function scrub(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const statement of SCRUB_STATEMENTS) {
      const result = await client.query(statement)
      console.log(`  ${String(result.rowCount ?? 0).padStart(6)}  ${statement.split(' WHERE')[0]}`)
    }
    await client.query('COMMIT')
  }
  catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
  finally {
    client.release()
    await pool.end()
  }
}

async function main() {
  const devUrl = process.env.DATABASE_DEV_URL
  const prodUrl = process.env.DATABASE_URL
  if (!devUrl)
    fail('DATABASE_DEV_URL is not set')
  if (!prodUrl)
    fail('DATABASE_URL is not set')

  const neon = createNeonClient()
  const [branches, endpoints] = await Promise.all([neon.listBranches(), neon.listEndpoints()])

  const target = resolveTarget({
    branches,
    endpoints,
    devEndpointId: endpointIdFromUrl(devUrl),
    prodEndpointId: endpointIdFromUrl(prodUrl),
  })
  if (!target.ok)
    fail(target.reason)

  const { branch, parent } = target
  console.log('')
  console.log(`--- db:refresh:dev [${DRY_RUN ? 'DRY RUN' : 'RESET'}] ---`)
  console.log(`  target  ${branch.name}  (${branch.id})`)
  console.log(`  parent  ${parent.name}  (${parent.id})`)

  // Neon refuses to reset a branch that has children.
  const children = childrenOf(branches, branch.id)
  if (children.length > 0) {
    console.error('')
    console.error(`  ${branch.name} has ${children.length} child branch(es). Neon will not reset a branch with children:`)
    for (const child of children)
      console.error(`    ${child.name.padEnd(20)} ${child.id}  (${child.current_state})`)
    console.error('')
    console.error('  Orphans (no live dispatch slot):   pnpm dispatch neon-prune')
    console.error('  A live worktree\'s branch:           pnpm dispatch cleanup <issue>, or delete only its DB branch —')
    console.error('                                      `pnpm dispatch start <issue>` recreates it from the refreshed parent.')
    console.error('')
    process.exit(1)
  }

  console.log('')
  console.log('  scrub plan (one transaction on the reset branch):')
  for (const statement of SCRUB_STATEMENTS)
    console.log(`    ${statement.split(' WHERE')[0]}`)
  console.log('')

  if (DRY_RUN) {
    console.log('Dry run complete — nothing was touched.')
    console.log('')
    return
  }

  console.log(`Resetting ${branch.name} from ${parent.name}...`)
  const operations = await neon.resetFromParent(branch.id, parent.id)
  await neon.waitForOperations(operations)
  console.log(`  reset finished (${operations.length} Neon operation(s))`)
  console.log('')

  console.log('Scrubbing...')
  await scrub(devUrl)
  console.log('')
  console.log(`Done. ${branch.name} is a scrubbed copy of ${parent.name}.`)
  console.log('If your code has schema changes the parent lacks, run: pnpm db:push:dev')
  console.log('')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
