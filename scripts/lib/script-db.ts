import process from 'node:process'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/shared/db/schema'

/**
 * DB client for migration/backfill scripts — explicit target, no server-env.
 *
 * App code imports `db` from `@/shared/db`, which pulls the full server-env
 * contract (Zod parse + production boot gates like META_TEST_EVENT_CODE /
 * VOIP_DEV_OVERRIDE_NUMBER). Those gates protect DEPLOYMENTS; a local script
 * impersonating one via `NODE_ENV=production` trips them against dev env
 * files (discovered during the Wave-1 prod cutover, 2026-07-14).
 *
 * Scripts choose their database explicitly instead:
 *   (default)      → DATABASE_DEV_URL — `.env.local` wins, preserving
 *                    per-worktree Neon-branch isolation
 *   --target=prod  → DATABASE_URL — the deliberate choice, host printed loudly
 *
 * Env loading is plain dotenv (`.env.local` first, then `.env`; never
 * overwrites already-set vars). No dotenv-expand — expand treats ""-valued
 * vars as unset and re-injects file values over shell pre-emptions.
 */
export function createScriptDb() {
  config({ path: '.env.local' })
  config({ path: '.env' })
  const target = process.argv.includes('--target=prod') ? 'prod' : 'dev'
  const url = target === 'prod' ? process.env.DATABASE_URL : process.env.DATABASE_DEV_URL
  if (!url) {
    throw new Error(`[script-db] no database URL for target "${target}" (${target === 'prod' ? 'DATABASE_URL' : 'DATABASE_DEV_URL'} unset)`)
  }
  console.warn(`[script-db] target=${target} host=${new URL(url).hostname}`)
  const pool = new Pool({ connectionString: url })
  return drizzle(pool, { schema })
}

export type ScriptDb = ReturnType<typeof createScriptDb>
