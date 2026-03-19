import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.meta from project root — NOT .env
config({ path: path.resolve(__dirname, '..', '..', '..', '.env.meta') })

const REQUIRED = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_ACCESS_TOKEN',
  'META_AD_ACCOUNT_ID',
  'META_PAGE_ID',
] as const

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌  Missing required env var: ${key}`)
    console.error(`    Add it to .env.meta at the project root.`)
    process.exit(1)
  }
}

export const metaEnv = {
  appId: process.env.META_APP_ID as string,
  appSecret: process.env.META_APP_SECRET as string,
  accessToken: process.env.META_ACCESS_TOKEN as string,
  adAccountId: process.env.META_AD_ACCOUNT_ID as string, // already act_ prefixed
  pageId: process.env.META_PAGE_ID as string,
} satisfies Record<string, string>
