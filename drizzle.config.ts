import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import env from '@/shared/config/server-env'

config({ path: '.env' })

export default defineConfig({
  schema: './src/shared/db/schema/index.ts',
  out: './src/shared/db/migrations',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
