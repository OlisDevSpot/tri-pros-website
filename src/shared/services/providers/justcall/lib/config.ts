import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * JustCall env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Auth: JustCall v2.1 uses `Authorization: api_key:api_secret` (encoding
 * empirically confirmed in the migration plan's Task 1 auth spike — swap the
 * client's `buildAuthHeader` to base64 Basic only if the live probe shows that).
 *
 * Webhook signature: HMAC-SHA256 keyed with `JUSTCALL_API_SECRET` — there is NO
 * separate webhook secret (unlike CloudTalk's `?secret=` query param). The API
 * secret does double duty as the REST credential and the HMAC key.
 */
export const justcallEnvFragment = z.object({
  JUSTCALL_API_KEY: z.string().optional(),
  JUSTCALL_API_SECRET: z.string().optional(),
})

export type ParsedJustcallEnv = z.infer<typeof justcallEnvFragment>

export interface JustcallRuntimeConfig {
  apiKey: string
  apiSecret: string
}

const helpers = createProviderConfig({
  provider: 'justcall',
  fragment: justcallEnvFragment,
  requiredKeys: ['JUSTCALL_API_KEY', 'JUSTCALL_API_SECRET'],
  toConfig: (parsed): JustcallRuntimeConfig => ({
    apiKey: parsed.JUSTCALL_API_KEY!,
    apiSecret: parsed.JUSTCALL_API_SECRET!,
  }),
})

export const buildJustcallConfig = helpers.build
export const getJustcallConfig = helpers.get
export const isJustcallConfigured = helpers.isConfigured
export const justcallConfigMeta = helpers.configMeta
