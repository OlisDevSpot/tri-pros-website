import { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

/**
 * Pipedrive env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Note: PIPEDRIVE_BASE_URL was previously in server-env but had zero
 * consumers — removed as part of this migration. The pipedrive SDK uses
 * its own default base URL.
 */
export const pipedriveEnvFragment = z.object({
  PIPEDRIVE_API_KEY: z.string().optional(),
})

export type ParsedPipedriveEnv = z.infer<typeof pipedriveEnvFragment>

export interface PipedriveRuntimeConfig {
  apiKey: string
}

const REQUIRED_KEYS = ['PIPEDRIVE_API_KEY'] as const satisfies ReadonlyArray<keyof ParsedPipedriveEnv>

function listMissingPipedrive(): string[] {
  return REQUIRED_KEYS.filter(k => !env[k])
}

export function buildPipedriveConfig(parsed: ParsedPipedriveEnv): PipedriveRuntimeConfig {
  const missing = REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('pipedrive', missing)
  }
  return {
    apiKey: parsed.PIPEDRIVE_API_KEY!,
  }
}

let _cache: PipedriveRuntimeConfig | null = null
export function getPipedriveConfig(): PipedriveRuntimeConfig {
  if (_cache) {
    return _cache
  }
  _cache = buildPipedriveConfig(env)
  return _cache
}

export function isPipedriveConfigured(): boolean {
  return listMissingPipedrive().length === 0
}

export const pipedriveConfigMeta = {
  service: 'pipedrive' as const,
  isConfigured: isPipedriveConfigured,
  listMissing: listMissingPipedrive,
} as const
