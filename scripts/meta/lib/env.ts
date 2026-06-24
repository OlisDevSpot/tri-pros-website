/* eslint-disable node/prefer-global/process */
// Load .env.local then .env from the project root (shared loader, CWD-relative),
// matching every other CLI script. The Marketing-API vars below were ported from
// the old standalone .env.meta into .env's Meta section on 2026-06-24.
import '../../lib/load-env'

const REQUIRED = [
  'META_APP_ID',
  'META_ACCESS_TOKEN',
  'META_AD_ACCOUNT_ID',
  'META_PAGE_ID',
] as const

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌  Missing required env var: ${key}`)
    console.error(`    Add it to .env at the project root (Meta section).`)
    process.exit(1)
  }
}

export const metaEnv = {
  appId: process.env.META_APP_ID as string,
  accessToken: process.env.META_ACCESS_TOKEN as string,
  adAccountId: process.env.META_AD_ACCOUNT_ID as string, // already act_ prefixed
  pageId: process.env.META_PAGE_ID as string,
} satisfies Record<string, string>
