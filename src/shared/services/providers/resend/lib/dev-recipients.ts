interface GuardedEmail {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  // Optional because a Resend template email takes its subject from the template.
  subject?: string
}

/**
 * The dev database is a copy of production with real customer addresses, so outside production an
 * email goes to one configured inbox or does not go. The subject keeps the intended recipients visible.
 */
export function applyDevRecipientOverride<T extends GuardedEmail>(
  payload: T,
  env: { isProduction: boolean, override: string | undefined },
): T {
  if (env.isProduction) {
    return payload
  }
  if (!env.override) {
    throw new Error('EMAIL_DEV_OVERRIDE is not set. Outside production every email goes to that address, so nothing was sent.')
  }
  const intended = [payload.to].flat().join(', ')
  return {
    ...payload,
    to: env.override,
    cc: undefined,
    bcc: undefined,
    subject: payload.subject === undefined ? undefined : `[to ${intended}] ${payload.subject}`,
  }
}
