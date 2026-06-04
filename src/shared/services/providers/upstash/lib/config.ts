import { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

/**
 * Env story for two distinct services that historically live under
 * `providers/upstash/`:
 *   1. QStash (Upstash's task queue / scheduled jobs) — publisher + receiver
 *   2. Ably (realtime pub/sub) — NOT an Upstash product
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Note: QSTASH_URL was previously in server-env but had zero consumers
 * (the qstash client hardcodes its baseUrl) — removed as part of this
 * migration.
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

const QSTASH_REQUIRED_KEYS = [
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
] as const satisfies ReadonlyArray<keyof ParsedQstashEnv>

function listMissingQstash(): string[] {
  return QSTASH_REQUIRED_KEYS.filter(k => !env[k])
}

export function buildQstashConfig(parsed: ParsedQstashEnv): QstashRuntimeConfig {
  const missing = QSTASH_REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('qstash', missing)
  }
  return {
    token: parsed.QSTASH_TOKEN!,
    currentSigningKey: parsed.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: parsed.QSTASH_NEXT_SIGNING_KEY!,
  }
}

let _qstashCache: QstashRuntimeConfig | null = null
export function getQstashConfig(): QstashRuntimeConfig {
  if (_qstashCache) {
    return _qstashCache
  }
  _qstashCache = buildQstashConfig(env)
  return _qstashCache
}

export function isQstashConfigured(): boolean {
  return listMissingQstash().length === 0
}

export const qstashConfigMeta = {
  service: 'qstash' as const,
  isConfigured: isQstashConfigured,
  listMissing: listMissingQstash,
} as const

// ────────────────────────────────────────────────────────────────────────────
// Ably
//
// TODO (backlog): move this section + `../realtime.ts` to `providers/ably/`.
// Ably is not an Upstash product; it lives here by historical accident. The
// Phase 2 migration keeps it physically co-located but exposes it as a peer
// service in the boot banner (its own meta). When Ably is split out, this
// block + the realtime.ts client move to `providers/ably/{lib/config.ts,client.ts}`
// and consumers update their import paths.
// ────────────────────────────────────────────────────────────────────────────

export const ablyEnvFragment = z.object({
  ABLY_API_KEY: z.string().optional(),
})

export type ParsedAblyEnv = z.infer<typeof ablyEnvFragment>

export interface AblyRuntimeConfig {
  apiKey: string
}

const ABLY_REQUIRED_KEYS = ['ABLY_API_KEY'] as const satisfies ReadonlyArray<keyof ParsedAblyEnv>

function listMissingAbly(): string[] {
  return ABLY_REQUIRED_KEYS.filter(k => !env[k])
}

export function buildAblyConfig(parsed: ParsedAblyEnv): AblyRuntimeConfig {
  const missing = ABLY_REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('ably', missing)
  }
  return {
    apiKey: parsed.ABLY_API_KEY!,
  }
}

let _ablyCache: AblyRuntimeConfig | null = null
export function getAblyConfig(): AblyRuntimeConfig {
  if (_ablyCache) {
    return _ablyCache
  }
  _ablyCache = buildAblyConfig(env)
  return _ablyCache
}

export function isAblyConfigured(): boolean {
  return listMissingAbly().length === 0
}

export const ablyConfigMeta = {
  service: 'ably' as const,
  isConfigured: isAblyConfigured,
  listMissing: listMissingAbly,
} as const
