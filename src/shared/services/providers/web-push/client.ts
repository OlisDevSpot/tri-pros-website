import env from '@/shared/config/server-env'

import 'server-only'

// VAPID config is sourced ONLY from env. There's no module-level "is the
// client configured" flag — the source of truth is whether the env vars
// are present, and we re-derive that on every call. The web-push library
// accepts `vapidDetails` per-call inside `sendNotification`'s options
// argument (RequestOptions in @types/web-push), so we never need to call
// the legacy `webpush.setVapidDetails()` global setter.
export interface VapidDetails {
  subject: string
  publicKey: string
  privateKey: string
}

// Returns the validated VAPID config, or null if any of the three env
// vars is missing. Callers soft-skip on null (e.g. dev without keys).
export function getVapidDetails(): VapidDetails | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = env.VAPID_PRIVATE_KEY
  const subject = env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    return null
  }
  return { subject, publicKey, privateKey }
}
