import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * QuickBooks env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * QB is all-or-nothing: the OAuth callback needs CLIENT_ID/SECRET/REDIRECT_URI,
 * token refresh needs CLIENT_ID/SECRET, and webhook verification needs
 * WEBHOOK_VERIFIER_TOKEN — but you either stand up the whole integration or
 * none of it. So all four are `requiredKeys`; a half-configured QB surfaces a
 * single `NotConfiguredError` listing every gap rather than failing per-path.
 */
export const quickbooksEnvFragment = z.object({
  QB_CLIENT_ID: z.string().optional(),
  QB_CLIENT_SECRET: z.string().optional(),
  QB_REDIRECT_URI: z.string().optional(),
  QB_WEBHOOK_VERIFIER_TOKEN: z.string().optional(),
})

export type ParsedQuickbooksEnv = z.infer<typeof quickbooksEnvFragment>

export interface QuickbooksRuntimeConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  webhookVerifierToken: string
}

const helpers = createProviderConfig({
  provider: 'quickbooks',
  fragment: quickbooksEnvFragment,
  requiredKeys: [
    'QB_CLIENT_ID',
    'QB_CLIENT_SECRET',
    'QB_REDIRECT_URI',
    'QB_WEBHOOK_VERIFIER_TOKEN',
  ],
  toConfig: (parsed): QuickbooksRuntimeConfig => ({
    clientId: parsed.QB_CLIENT_ID!,
    clientSecret: parsed.QB_CLIENT_SECRET!,
    redirectUri: parsed.QB_REDIRECT_URI!,
    webhookVerifierToken: parsed.QB_WEBHOOK_VERIFIER_TOKEN!,
  }),
})

export const buildQuickbooksConfig = helpers.build
export const getQuickbooksConfig = helpers.get
export const isQuickbooksConfigured = helpers.isConfigured
export const quickbooksConfigMeta = helpers.configMeta
