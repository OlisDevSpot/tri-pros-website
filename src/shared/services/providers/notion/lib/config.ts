import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Notion env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export const notionEnvFragment = z.object({
  NOTION_API_KEY: z.string().optional(),
})

export type ParsedNotionEnv = z.infer<typeof notionEnvFragment>

export interface NotionRuntimeConfig {
  apiKey: string
}

const helpers = createProviderConfig({
  provider: 'notion',
  fragment: notionEnvFragment,
  requiredKeys: ['NOTION_API_KEY'],
  toConfig: (parsed): NotionRuntimeConfig => ({
    apiKey: parsed.NOTION_API_KEY!,
  }),
})

export const buildNotionConfig = helpers.build
export const getNotionConfig = helpers.get
export const isNotionConfigured = helpers.isConfigured
export const notionConfigMeta = helpers.configMeta
