import { drizzle } from 'drizzle-orm/node-postgres'

import { Pool } from 'pg'
import env from '@/config/server-env'
import * as schema from '@/db/schema'

const pool = new Pool({
  connectionString: env.DATABASE_URL!,
})

const db = drizzle(pool, {
  // eslint-disable-next-line node/prefer-global/process
  logger: process.env.npm_config_logger === 'true',
  schema,
})

export type DB = typeof db
export { db }
