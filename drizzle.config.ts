import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import env from '@/shared/config/server-env'

config({ path: '.env' })

// eslint-disable-next-line node/prefer-global/process
const dbUrl = process.env.DRIZZLE_TARGET === 'dev' ? env.DATABASE_DEV_URL! : env.DATABASE_URL

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
