import { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

/**
 * Cloudflare R2 env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Note: R2_TOKEN and R2_JURISDICTION were previously in server-env but had
 * zero consumers — removed as part of this migration. R2 uses AWS S3-compat
 * credentials (access key id + secret) and an account-scoped endpoint URL.
 */
export const r2EnvFragment = z.object({
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
})

export type ParsedR2Env = z.infer<typeof r2EnvFragment>

export interface R2RuntimeConfig {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
}

const REQUIRED_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const satisfies ReadonlyArray<keyof ParsedR2Env>

function listMissingR2(): string[] {
  return REQUIRED_KEYS.filter(k => !env[k])
}

export function buildR2Config(parsed: ParsedR2Env): R2RuntimeConfig {
  const missing = REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('r2', missing)
  }
  const accountId = parsed.R2_ACCOUNT_ID!
  return {
    accountId,
    accessKeyId: parsed.R2_ACCESS_KEY_ID!,
    secretAccessKey: parsed.R2_SECRET_ACCESS_KEY!,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  }
}

let _cache: R2RuntimeConfig | null = null
export function getR2Config(): R2RuntimeConfig {
  if (_cache) {
    return _cache
  }
  _cache = buildR2Config(env)
  return _cache
}

export function isR2Configured(): boolean {
  return listMissingR2().length === 0
}

export const r2ConfigMeta = {
  service: 'r2' as const,
  isConfigured: isR2Configured,
  listMissing: listMissingR2,
} as const
