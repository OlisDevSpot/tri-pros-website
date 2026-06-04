import { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

/**
 * Resend env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export const resendEnvFragment = z.object({
  RESEND_API_KEY: z.string().optional(),
})

export type ParsedResendEnv = z.infer<typeof resendEnvFragment>

export interface ResendRuntimeConfig {
  apiKey: string
}

const REQUIRED_KEYS = ['RESEND_API_KEY'] as const satisfies ReadonlyArray<keyof ParsedResendEnv>

function listMissingResend(): string[] {
  return REQUIRED_KEYS.filter(k => !env[k])
}

export function buildResendConfig(parsed: ParsedResendEnv): ResendRuntimeConfig {
  const missing = REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('resend', missing)
  }
  return {
    apiKey: parsed.RESEND_API_KEY!,
  }
}

let _cache: ResendRuntimeConfig | null = null
export function getResendConfig(): ResendRuntimeConfig {
  if (_cache) {
    return _cache
  }
  _cache = buildResendConfig(env)
  return _cache
}

export function isResendConfigured(): boolean {
  return listMissingResend().length === 0
}

export const resendConfigMeta = {
  service: 'resend' as const,
  isConfigured: isResendConfigured,
  listMissing: listMissingResend,
} as const
