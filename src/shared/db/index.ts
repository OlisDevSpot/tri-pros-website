import { drizzle } from 'drizzle-orm/node-postgres'

import { Pool } from 'pg'
import env from '@/shared/config/server-env'
import * as schema from '@/shared/db/schema'

// DB selection — two independent axes, never NODE_ENV:
//   1. DRIZZLE_TARGET (explicit data-target lever, used by CLI scripts and the
//      db:*:dev package scripts): 'prod' → DATABASE_URL, 'dev' → DATABASE_DEV_URL.
//   2. Unset → the deployment environment decides: the deployed prod site
//      (VERCEL_ENV === 'production') gets DATABASE_URL; everywhere else gets
//      the dev URL. Local scripts reach prod ONLY via explicit DRIZZLE_TARGET=prod.
// see docs/codebase-conventions/environment.md#environment-axes
// eslint-disable-next-line node/prefer-global/process
const target = process.env.DRIZZLE_TARGET
const dbUrl = target === 'prod'
  ? env.DATABASE_URL
  : target === 'dev'
    ? (env.DATABASE_DEV_URL ?? env.DATABASE_URL)
    : env.VERCEL_ENV === 'production'
      ? env.DATABASE_URL
      : (env.DATABASE_DEV_URL ?? env.DATABASE_URL)

const pool = new Pool({
  connectionString: dbUrl,
})

const db = drizzle(pool, {
  // eslint-disable-next-line node/prefer-global/process
  logger: process.env.npm_config_logger === 'true',
  schema,
})

export type DB = typeof db
export type DbOrTx = DB | Parameters<Parameters<DB['transaction']>[0]>[0]
export { db }
