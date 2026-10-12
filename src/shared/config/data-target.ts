import process from 'node:process'

import env from '@/shared/config/server-env'

/**
 * Whether this process works on production data. DRIZZLE_TARGET is the explicit lever CLI scripts use;
 * unset, the deployment decides. Never NODE_ENV: Vercel previews build as production too.
 * Policies that follow the data (calendar guests, Google's emails, the calendar name) key on this, not on the runtime,
 * so a local script run against production treats production events the way the deployed site does.
 */
export function isProductionData(): boolean {
  const target = process.env.DRIZZLE_TARGET
  if (target === 'prod') {
    return true
  }
  if (target === 'dev') {
    return false
  }
  return env.VERCEL_ENV === 'production'
}
