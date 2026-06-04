import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Web Push (VAPID) env var schema fragment + boot-banner meta.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Deviation from the canonical five-export shape, by design:
 * - The public key `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is a build-inlined client var
 *   and stays in `server-env`'s general section — NEXT_PUBLIC vars do not live
 *   in a server-side provider fragment. Only the two server-only keys
 *   (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) move here.
 * - There is intentionally NO throwing `getWebPushConfig()` accessor. Push must
 *   SOFT-SKIP when unconfigured (dev clones without keys), so the provider's
 *   accessor is `getVapidDetails()` in `client.ts`, which returns `null` rather
 *   than throwing `NotConfiguredError`. This file only contributes the fragment
 *   + the boot-banner `configMeta` so `pnpm dev` reports web-push status.
 *
 * The banner predicate checks the two server-only keys; `getVapidDetails()`
 * additionally requires the public key at use-time (all three or null).
 */
export const webPushEnvFragment = z.object({
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
})

export type ParsedWebPushEnv = z.infer<typeof webPushEnvFragment>

const helpers = createProviderConfig({
  provider: 'web-push',
  fragment: webPushEnvFragment,
  requiredKeys: ['VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'],
  toConfig: parsed => ({
    privateKey: parsed.VAPID_PRIVATE_KEY!,
    subject: parsed.VAPID_SUBJECT!,
  }),
})

export const isWebPushConfigured = helpers.isConfigured
export const webPushConfigMeta = helpers.configMeta
