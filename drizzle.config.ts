import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import env from '@/config/server-env'

config({ path: '.env' })

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
