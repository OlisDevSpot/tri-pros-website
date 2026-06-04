import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

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

const helpers = createProviderConfig({
  provider: 'resend',
  fragment: resendEnvFragment,
  requiredKeys: ['RESEND_API_KEY'],
  toConfig: (parsed): ResendRuntimeConfig => ({
    apiKey: parsed.RESEND_API_KEY!,
  }),
})

export const buildResendConfig = helpers.build
export const getResendConfig = helpers.get
export const isResendConfigured = helpers.isConfigured
export const resendConfigMeta = helpers.configMeta
