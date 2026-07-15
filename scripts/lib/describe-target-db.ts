import process from 'node:process'

/**
 * Logs which DB a CLI script will hit. Call at startup so the operator
 * can abort before writes begin. Mirrors the selection logic in
 * src/shared/db/index.ts — DRIZZLE_TARGET decides; NODE_ENV is never involved.
 * See docs/codebase-conventions/environment.md#environment-axes.
 */
export function describeTargetDb(): { env: string, host: string } {
  const target = process.env.DRIZZLE_TARGET ?? '(unset → dev)'
  const isProd = process.env.DRIZZLE_TARGET === 'prod'
  const raw = isProd
    ? process.env.DATABASE_URL
    : (process.env.DATABASE_DEV_URL ?? process.env.DATABASE_URL)
  let host = '(unknown)'
  if (raw) {
    try {
      host = new URL(raw).host
    }
    catch { /* malformed URL — surface the unknown */ }
  }
  return { env: target, host }
}
