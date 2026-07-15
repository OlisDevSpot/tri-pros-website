import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Self-contained env loading — deliberately NO import of server-env here.
// drizzle-kit bundles this config with its own loader, where server-env's
// dotenv calls resolve differently than under tsx/Next and .env.local was
// silently skipped — sending worktree `db:push:dev` runs to the SHARED dev
// branch (defeating per-worktree Neon isolation). Load order: .env.local
// first (dispatch worktree override wins — dotenv never overwrites), then .env.
// `override: true` is required: drizzle-kit preloads `.env` into process.env
// BEFORE this config file executes, and plain dotenv never overwrites set vars
// — without override, the worktree's .env.local DATABASE_DEV_URL silently loses
// and `db:push:dev` hits the SHARED dev branch (the 2026-05-04 drift incident
// class). Diagnosed 2026-07-13 (#259).
config({ path: '.env.local', override: true })
config({ path: '.env' })

// Unset never silently means prod: only an explicit DRIZZLE_TARGET=prod reaches
// DATABASE_URL; everything else (unset or 'dev') gets the dev branch.
// see docs/codebase-conventions/environment.md#environment-axes
// eslint-disable-next-line node/prefer-global/process
const dbUrl = process.env.DRIZZLE_TARGET === 'prod' ? process.env.DATABASE_URL! : process.env.DATABASE_DEV_URL!

export default defineConfig({
  schema: './src/shared/db/schema/index.ts',
  out: './src/shared/db/migrations',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: dbUrl,
  },
})
