import type { ZodError } from 'zod'

import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

import z from 'zod'

expand(config({ path: '.env' }))

const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_BASE_URL: z.string(),

  // Database
  DATABASE_URL: z.string(),

  // Payload
  PAYLOAD_SECRET: z.string(),
  PAYLOAD_DATABASE_URI: z.string(),

  // Better Auth
  BETTER_AUTH_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string(),

  // GOOGLE
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // RESEND
  RESEND_API_KEY: z.string(),

  // MONDAY
  MONDAY_API_TOKEN: z.string(),

  // PIPEDRIVE
  PIPEDRIVE_BASE_URL: z.string(),
  PIPEDRIVE_API_KEY: z.string(),

  // HUBSPOT
  HUBSPOT_BASE_URL: z.string(),
  HUBSPOT_CLIENT_ID: z.string(),
  HUBSPOT_CLIENT_SECRET: z.string(),
  HUBSPOT_APP_REDIRECT_URL: z.string(),

  // DOCUSIGN
  DS_USER_ID: z.string(),
  DS_ACCOUNT_ID: z.string(),
  DS_INTEGRATION_KEY: z.string(),
  DS_JWT_PRIVATE_KEY_PATH: z.string(),

  // NOTION
  NOTION_API_KEY: z.string(),

  // CLOUDFLARE R2
  R2_BUCKET_NAME: z.string(),
  R2_ACCOUNT_ID: z.string(),
  R2_TOKEN: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_JURISDICTION: z.string(),

  // UPSTASH
  QSTASH_URL: z.string(),
  QSTASH_TOKEN: z.string(),
  QSTASH_CURRENT_SIGNING_KEY: z.string(),
  QSTASH_NEXT_SIGNING_KEY: z.string(),
})

export type env = z.infer<typeof envSchema>

// eslint-disable-next-line import/no-mutable-exports, ts/no-redeclare
let env: env

try {
  // eslint-disable-next-line node/prefer-global/process
  env = envSchema.parse(process.env)
}
catch (e) {
  const error = e as ZodError
  console.error('❌ Invalid environment variables:')
  console.error(z.flattenError(error).fieldErrors)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}

export default env
