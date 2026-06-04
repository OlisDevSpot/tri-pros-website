import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Cloudflare R2 env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Note: R2_TOKEN and R2_JURISDICTION were previously in server-env but had
 * zero consumers — removed during the Phase 2 migration. R2 uses AWS S3-
 * compat credentials (access key id + secret) and an account-scoped
 * endpoint URL derived from R2_ACCOUNT_ID.
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

const helpers = createProviderConfig({
  provider: 'r2',
  fragment: r2EnvFragment,
  requiredKeys: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
  toConfig: (parsed): R2RuntimeConfig => {
    const accountId = parsed.R2_ACCOUNT_ID!
    return {
      accountId,
      accessKeyId: parsed.R2_ACCESS_KEY_ID!,
      secretAccessKey: parsed.R2_SECRET_ACCESS_KEY!,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    }
  },
})

export const buildR2Config = helpers.build
export const getR2Config = helpers.get
export const isR2Configured = helpers.isConfigured
export const r2ConfigMeta = helpers.configMeta
