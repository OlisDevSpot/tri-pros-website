import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Resend env var schema fragment + runtime-config builder + accessor.
 *
 */
export const resendEnvFragment = z.object({
  RESEND_API_KEY: z.string().optional(),
  // Outside production every email is rerouted to this inbox. server-env refuses it in production.
  EMAIL_DEV_OVERRIDE: z.preprocess(value => value === '' ? undefined : value, z.email().optional()),
})

export type ParsedResendEnv = z.infer<typeof resendEnvFragment>

export interface ResendRuntimeConfig {
  apiKey: string
  devRecipientOverride: string | undefined
}

const helpers = createProviderConfig({
  provider: 'resend',
  fragment: resendEnvFragment,
  requiredKeys: ['RESEND_API_KEY'],
  toConfig: (parsed): ResendRuntimeConfig => ({
    apiKey: parsed.RESEND_API_KEY!,
    devRecipientOverride: parsed.EMAIL_DEV_OVERRIDE,
  }),
})

export const getResendConfig = helpers.get
export const resendConfigMeta = helpers.configMeta
