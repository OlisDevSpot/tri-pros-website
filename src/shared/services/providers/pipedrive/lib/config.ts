import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Pipedrive env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Note: PIPEDRIVE_BASE_URL was previously in server-env but had zero
 * consumers — removed during the Phase 2 migration. The pipedrive SDK
 * uses its own default base URL.
 */
export const pipedriveEnvFragment = z.object({
  PIPEDRIVE_API_KEY: z.string().optional(),
})

export type ParsedPipedriveEnv = z.infer<typeof pipedriveEnvFragment>

export interface PipedriveRuntimeConfig {
  apiKey: string
}

const helpers = createProviderConfig({
  provider: 'pipedrive',
  fragment: pipedriveEnvFragment,
  requiredKeys: ['PIPEDRIVE_API_KEY'],
  toConfig: (parsed): PipedriveRuntimeConfig => ({
    apiKey: parsed.PIPEDRIVE_API_KEY!,
  }),
})

export const getPipedriveConfig = helpers.get
export const isPipedriveConfigured = helpers.isConfigured
export const pipedriveConfigMeta = helpers.configMeta
