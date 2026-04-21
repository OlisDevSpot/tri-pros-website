import { drizzle } from 'drizzle-orm/node-postgres'

import { Pool } from 'pg'
import env from '@/shared/config/server-env'
import * as schema from '@/shared/db/schema'

const dbUrl = env.NODE_ENV === 'production' ? env.DATABASE_URL : (env.DATABASE_DEV_URL ?? env.DATABASE_URL)

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
