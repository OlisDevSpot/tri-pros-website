import type { PgTable } from 'drizzle-orm/pg-core'

import { getTableName, sql } from 'drizzle-orm'

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/shared/db/schema'

/**
 * Snapshot prod → dev database using Drizzle ORM.
 *
 * Reads all business data from DATABASE_URL (prod), tags human-visible text
 * fields with a 🧪 prefix, and inserts into DATABASE_DEV_URL (dev).
 *
 * Usage:
 *   pnpm db:snapshot              # incremental — adds new prod rows, skips existing
 *   pnpm db:snapshot --fresh      # flush dev first, then full restore from prod
 *   pnpm db:snapshot --dry-run    # print row counts only, no writes
 *
 * Postgres concepts in play:
 *
 *   TRUNCATE ... CASCADE RESTART IDENTITY  (--fresh)
 *     Removes all rows + every FK-dependent child. Resets serial sequences.
 *
 *   INSERT ... ON CONFLICT DO NOTHING  (incremental)
 *     Skips rows whose PK already exists — idempotent, safe to re-run.
 *
 *   setval()  (--fresh, serial-PK tables)
 *     After explicit-ID inserts, advances the sequence counter past max(id)
 *     so future app-generated rows don't collide.
 *
 *   FK-safe ordering
 *     Tables listed parents-first so Postgres FK checks pass without needing
 *     superuser privileges (Neon doesn't allow session_replication_role).
 */
import './lib/load-env'

/* ---------- env validation -------------------------------------------- */

const PROD_URL = process.env.DATABASE_URL
const DEV_URL = process.env.DATABASE_DEV_URL

if (!PROD_URL) { console.error('DATABASE_URL is not set'); process.exit(1) }
if (!DEV_URL) { console.error('DATABASE_DEV_URL is not set'); process.exit(1) }
if (PROD_URL === DEV_URL) {
  console.error('DATABASE_URL and DATABASE_DEV_URL are the same — aborting to prevent data corruption')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const FRESH = process.argv.includes('--fresh')

/* ---------- drizzle instances ----------------------------------------- */

const prodPool = new Pool({ connectionString: PROD_URL })
const devPool = new Pool({ connectionString: DEV_URL })

const prodDb = drizzle(prodPool, { schema })
const devDb = drizzle(devPool, { schema })

/* ---------- tag helper ------------------------------------------------ */

const TAG = '🧪'

function tag(val: string | null | undefined): string | null {
  if (val == null)
    return null
  if (val.startsWith(TAG))
    return val
  return `${TAG} ${val}`
}

/* ---------- table config ---------------------------------------------- */

/**
 * Type-safe table config. `tagColumns` and `skipColumns` are validated
 * against the actual Drizzle schema — typos are caught at compile time.
 */
interface TableDef<T extends PgTable> {
  table: T
  /** Human-visible text columns that get the 🧪 prefix */
  tagColumns?: (keyof T['$inferSelect'])[]
  /** Columns to null out (e.g. third-party sync state that shouldn't carry over) */
  skipColumns?: (keyof T['$inferSelect'])[]
  /** Table uses a serial integer PK — needs setval() after restore */
  hasSequence?: boolean
}

/** Identity function for type inference on each table config. */
function def<T extends PgTable>(config: TableDef<T>): TableDef<PgTable> {
  // eslint-disable-next-line ts/no-unsafe-return -- deliberate type erasure for heterogeneous array
  return config as any
}

/**
 * FK-safe insertion order: parents before children.
 * The order matters for INSERT (Postgres checks FK constraints per row).
 * For TRUNCATE --fresh, CASCADE handles the graph automatically.
 */
const TABLES = [
  // ── Auth (users only — sessions/accounts are per-device) ──────────
  def({
    table: schema.user,
    tagColumns: ['name', 'nickname'],
    skipColumns: ['agentProfileJSON'],
  }),

  // ── Reference data ────────────────────────────────────────────────
  def({ table: schema.leadSourcesTable, tagColumns: ['name'] }),
  def({ table: schema.financeProviders, tagColumns: ['label'], hasSequence: true }),
  def({ table: schema.financeOptions, tagColumns: ['label'], hasSequence: true }),

  // ── Construction catalog (often seeded, not in prod) ──────────────
  def({ table: schema.trades, tagColumns: ['label'], hasSequence: true }),
  def({ table: schema.scopes, tagColumns: ['label'], hasSequence: true }),
  def({ table: schema.materials, tagColumns: ['label'], hasSequence: true }),
  def({ table: schema.addons, tagColumns: ['label'], hasSequence: true }),
  def({ table: schema.benefitCategories, tagColumns: ['label'], hasSequence: true }),
  def({ table: schema.benefits, hasSequence: true }),
  def({ table: schema.variables, hasSequence: true }),
  def({ table: schema.tags, tagColumns: ['label'], hasSequence: true }),

  // ── Catalog junctions ─────────────────────────────────────────────
  def({ table: schema.x_scopeMaterials, hasSequence: true }),
  def({ table: schema.x_materialBenefits, hasSequence: true }),
  def({ table: schema.x_scopeBenefits, hasSequence: true }),
  def({ table: schema.x_scopeVariables, hasSequence: true }),
  def({ table: schema.x_tradeBenefits, hasSequence: true }),

  // ── Core business entities ────────────────────────────────────────
  def({ table: schema.customers, tagColumns: ['name', 'address', 'city'] }),
  def({ table: schema.projects, tagColumns: ['title', 'homeownerName', 'city'] }),
  def({ table: schema.mediaFiles, hasSequence: true }),
  def({ table: schema.x_projectScopes }),
  def({ table: schema.x_projectMediaFiles }),

  def({
    table: schema.meetings,
    tagColumns: ['agentNotes'],
    skipColumns: ['gcalEventId', 'gcalEtag', 'gcalSyncedAt'],
  }),
  def({ table: schema.meetingParticipants }),

  def({
    table: schema.proposals,
    tagColumns: ['label'],
    skipColumns: ['signingRequestId'],
  }),
  def({ table: schema.proposalViews }),

  def({
    table: schema.activities,
    tagColumns: ['title'],
    skipColumns: ['gcalEventId', 'gcalEtag', 'gcalSyncedAt'],
  }),
  def({ table: schema.customerNotes }),

  // ── Skipped (device-bound / ephemeral) ────────────────────────────
  // pushSubscriptions  — bound to browser VAPID endpoints
  // session / account  — per-device OAuth tokens
  // verification       — ephemeral auth codes
  // qbAuthTokens       — QuickBooks OAuth
  // binaWebhookLogs    — raw audit log
]

/* ---------- flush (--fresh) ------------------------------------------- */

/**
 * TRUNCATE root tables — CASCADE wipes every FK child automatically.
 * RESTART IDENTITY resets serial sequences so explicit-ID inserts work.
 */
const TRUNCATE_ROOTS: PgTable[] = [
  schema.user,
  schema.customers,
  schema.leadSourcesTable,
  schema.financeProviders,
  schema.trades,
  schema.benefitCategories,
  schema.tags,
  schema.variables,
]

async function flushDev() {
  if (DRY_RUN) {
    console.log('  [dry-run] Would TRUNCATE:', TRUNCATE_ROOTS.map(t => getTableName(t)).join(', '))
    console.log('')
    return
  }

  const tableList = TRUNCATE_ROOTS.map(t => `"${getTableName(t)}"`).join(', ')
  await devDb.execute(sql.raw(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`))
  console.log(`  Flushed ${TRUNCATE_ROOTS.length} root tables (+ FK children via CASCADE)`)
  console.log('')
}

/* ---------- sequence fix ---------------------------------------------- */

async function fixSequences() {
  const sequenceTables = TABLES.filter(t => t.hasSequence)
  if (sequenceTables.length === 0)
    return

  for (const { table } of sequenceTables) {
    const name = getTableName(table)
    await devDb.execute(sql.raw(
      `SELECT setval('${name}_id_seq', COALESCE((SELECT MAX(id) FROM "${name}"), 0) + 1, false)`,
    ))
  }

  console.log(`  Fixed ${sequenceTables.length} sequences`)
}

/* ---------- copy logic ------------------------------------------------ */

const BATCH_SIZE = 500

async function copyTable({ table, tagColumns = [], skipColumns = [] }: TableDef<PgTable>) {
  const name = getTableName(table)

  // Read all rows from prod — fully typed through Drizzle schema
  const rows: Record<string, unknown>[] = await prodDb.select().from(table)

  if (rows.length === 0) {
    console.log(`  --  ${name}: 0 rows`)
    return
  }

  if (DRY_RUN) {
    console.log(`  >>  ${name}: ${rows.length} rows`)
    return
  }

  // Apply transformations
  const tagSet = new Set(tagColumns as string[])
  const skipSet = new Set(skipColumns as string[])

  const transformed = rows.map((row) => {
    const copy = { ...row }

    // Tag human-visible text fields
    for (const col of tagSet) {
      if (col in copy && typeof copy[col] === 'string') {
        copy[col] = tag(copy[col] as string)
      }
    }

    // Null out skipped columns (third-party sync state, etc.)
    for (const col of skipSet) {
      copy[col] = null
    }

    return copy
  })

  // Batch insert with ON CONFLICT DO NOTHING
  let inserted = 0

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE)
    const result = await devDb.insert(table).values(batch).onConflictDoNothing()
    inserted += result.rowCount ?? 0
  }

  const skipped = rows.length - inserted
  const note = skipped > 0 ? ` (${skipped} already existed)` : ''
  console.log(`  ok  ${name}: ${inserted}/${rows.length} rows${note}`)
}

/* ---------- main ------------------------------------------------------ */

async function main() {
  const mode = DRY_RUN ? 'DRY RUN' : FRESH ? 'FRESH RESTORE' : 'INCREMENTAL'
  console.log('')
  console.log(`--- db:snapshot [${mode}] ---`)
  console.log('')

  // Verify connectivity + show DB info
  try {
    const prodResult = await prodDb.execute(
      sql`SELECT current_database() AS db, pg_size_pretty(pg_database_size(current_database())) AS size`,
    )
    const prodInfo = prodResult.rows[0]
    console.log(`  prod: ${prodInfo.db} (${prodInfo.size})`)
  }
  catch (err) {
    console.error('  Cannot connect to prod:', (err as Error).message)
    process.exit(1)
  }

  try {
    const devResult = await devDb.execute(
      sql`SELECT current_database() AS db, pg_size_pretty(pg_database_size(current_database())) AS size`,
    )
    const devInfo = devResult.rows[0]
    console.log(`  dev:  ${devInfo.db} (${devInfo.size})`)
  }
  catch (err) {
    console.error('  Cannot connect to dev:', (err as Error).message)
    process.exit(1)
  }

  console.log('')

  if (FRESH) {
    console.log('Flushing dev...')
    await flushDev()
  }

  console.log('Copying tables...')
  console.log('')

  for (const def of TABLES) {
    await copyTable(def)
  }

  if (!DRY_RUN) {
    console.log('')
    await fixSequences()
  }

  console.log('')
  if (DRY_RUN) {
    console.log('Dry run complete — no writes were made.')
  }
  else if (FRESH) {
    console.log('Fresh restore complete. Dev DB is a tagged copy of prod.')
    console.log('Run `pnpm db:seed:dev` if you also need catalog data (trades/scopes/materials).')
  }
  else {
    console.log('Incremental snapshot complete. New prod rows added to dev.')
  }
  console.log('')

  await prodPool.end()
  await devPool.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
