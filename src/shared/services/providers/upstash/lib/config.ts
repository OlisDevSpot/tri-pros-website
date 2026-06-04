import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Env story for two distinct providers that historically live under
 * `providers/upstash/`:
 *   1. QStash (Upstash's task queue / scheduled jobs) — publisher + receiver
 *   2. Ably (realtime pub/sub) — NOT an Upstash product
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Note: QSTASH_URL was previously in server-env but had zero consumers
 * (the qstash client hardcodes its baseUrl) — removed during Phase 2.
 */

// ────────────────────────────────────────────────────────────────────────────
// QStash
// ────────────────────────────────────────────────────────────────────────────

export const qstashEnvFragment = z.object({
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
})

export type ParsedQstashEnv = z.infer<typeof qstashEnvFragment>

export interface QstashRuntimeConfig {
  token: string
  currentSigningKey: string
  nextSigningKey: string
}

const qstashHelpers = createProviderConfig({
  provider: 'qstash',
  fragment: qstashEnvFragment,
  requiredKeys: ['QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY'],
  toConfig: (parsed): QstashRuntimeConfig => ({
    token: parsed.QSTASH_TOKEN!,
    currentSigningKey: parsed.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: parsed.QSTASH_NEXT_SIGNING_KEY!,
  }),
})

export const buildQstashConfig = qstashHelpers.build
export const getQstashConfig = qstashHelpers.get
export const isQstashConfigured = qstashHelpers.isConfigured
export const qstashConfigMeta = qstashHelpers.configMeta

// ────────────────────────────────────────────────────────────────────────────
// Ably
//
// TODO (backlog): move this section + `../realtime.ts` to `providers/ably/`.
// Ably is not an Upstash product; it lives here by historical accident.
// Phase 2 kept it physically co-located but exposes it as a peer provider
// in the boot banner (its own meta). When Ably is split out, this block +
// the realtime.ts client move to `providers/ably/{lib/config.ts,client.ts}`
// and consumers update their import paths.
// ────────────────────────────────────────────────────────────────────────────

export const ablyEnvFragment = z.object({
  ABLY_API_KEY: z.string().optional(),
})

export type ParsedAblyEnv = z.infer<typeof ablyEnvFragment>

export interface AblyRuntimeConfig {
  apiKey: string
}

const ablyHelpers = createProviderConfig({
  provider: 'ably',
  fragment: ablyEnvFragment,
  requiredKeys: ['ABLY_API_KEY'],
  toConfig: (parsed): AblyRuntimeConfig => ({
    apiKey: parsed.ABLY_API_KEY!,
  }),
})

export const buildAblyConfig = ablyHelpers.build
export const getAblyConfig = ablyHelpers.get
export const isAblyConfigured = ablyHelpers.isConfigured
export const ablyConfigMeta = ablyHelpers.configMeta
