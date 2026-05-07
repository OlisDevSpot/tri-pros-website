/**
 * Load env files in the same order Next.js uses: `.env.local` first,
 * then `.env`. dotenv won't overwrite already-set vars, so `.env.local`
 * wins — matching the behavior the dev server and `db:push:dev` see.
 *
 * Without this, `tsx` scripts that use plain `import 'dotenv/config'`
 * only load `.env`, missing the per-worktree `DATABASE_DEV_URL` override
 * that dispatch writes to `.env.local`.
 *
 * Import this at the top of every CLI script instead of `dotenv/config`.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config()
