import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * CloudTalk env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Note on the webhook secret: CloudTalk does NOT sign webhooks (no HMAC) —
 * the secret is passed as a query param on the inbound URL. The SAME value
 * protects both inbound surfaces:
 *   1. Mid-call routing endpoints (`/api/voip/routing/*`) — voip-in-house Phase 1
 *   2. Post-call webhook handler (`/api/webhooks/cloudtalk/route.ts`) — voip-campaigns Phase 1
 * Same trust model; one secret value, configured once into CloudTalk's
 * dashboard.
 *
 * `CLOUDTALK_WEBHOOK_IP_ALLOWLIST` lives on the fragment but is intentionally
 * excluded from `CloudtalkRuntimeConfig` — it's an edge-network detail, not
 * part of the runtime config consumed by app code.
 */
export const cloudtalkEnvFragment = z.object({
  // HTTP Basic auth — Access Key ID is the username, Access Key Secret is the password.
  CLOUDTALK_ACCESS_KEY_ID: z.string().optional(),
  CLOUDTALK_ACCESS_KEY_SECRET: z.string().optional(),
  // Shared inbound-traffic secret. 32+ chars when present so a half-set
  // secret can't slip through.
  CLOUDTALK_WEBHOOK_SECRET: z.string().min(32).optional(),
  // Optional comma-separated CIDRs for Vercel edge allowlist.
  CLOUDTALK_WEBHOOK_IP_ALLOWLIST: z.string().optional(),
})

export type ParsedCloudtalkEnv = z.infer<typeof cloudtalkEnvFragment>

export interface CloudtalkRuntimeConfig {
  accessKeyId: string
  accessKeySecret: string
  webhookSecret: string
}

const helpers = createProviderConfig({
  provider: 'cloudtalk',
  fragment: cloudtalkEnvFragment,
  requiredKeys: ['CLOUDTALK_ACCESS_KEY_ID', 'CLOUDTALK_ACCESS_KEY_SECRET', 'CLOUDTALK_WEBHOOK_SECRET'],
  toConfig: (parsed): CloudtalkRuntimeConfig => ({
    accessKeyId: parsed.CLOUDTALK_ACCESS_KEY_ID!,
    accessKeySecret: parsed.CLOUDTALK_ACCESS_KEY_SECRET!,
    webhookSecret: parsed.CLOUDTALK_WEBHOOK_SECRET!,
  }),
})

export const buildCloudtalkConfig = helpers.build
export const getCloudtalkConfig = helpers.get
export const isCloudtalkConfigured = helpers.isConfigured
export const cloudtalkConfigMeta = helpers.configMeta
