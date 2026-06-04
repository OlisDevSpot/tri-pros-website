import { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

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

const REQUIRED_KEYS = ['NOTION_API_KEY'] as const satisfies ReadonlyArray<keyof ParsedNotionEnv>

function listMissingNotion(): string[] {
  return REQUIRED_KEYS.filter(k => !env[k])
}

export function buildNotionConfig(parsed: ParsedNotionEnv): NotionRuntimeConfig {
  const missing = REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('notion', missing)
  }
  return {
    apiKey: parsed.NOTION_API_KEY!,
  }
}

let _cache: NotionRuntimeConfig | null = null
export function getNotionConfig(): NotionRuntimeConfig {
  if (_cache) {
    return _cache
  }
  _cache = buildNotionConfig(env)
  return _cache
}

export function isNotionConfigured(): boolean {
  return listMissingNotion().length === 0
}

export const notionConfigMeta = {
  service: 'notion' as const,
  isConfigured: isNotionConfigured,
  listMissing: listMissingNotion,
} as const
