/**
 * Logs which DB a CLI script will hit. Call at startup so the operator
 * can abort before writes begin. See memory/feedback-runtime-db-env.md.
 */
export function describeTargetDb(): { env: string, host: string } {
  const nodeEnv = process.env.NODE_ENV ?? '(unset)'
  const isProd = process.env.NODE_ENV === 'production'
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
  return { env: nodeEnv, host }
}
