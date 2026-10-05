import { Client } from '@notionhq/client'

import { lazyProxy } from '@/shared/config/lazy-proxy'

import { getNotionConfig } from './lib/config'

/**
 * Notion SDK client. Lazy-constructed via `lazyProxy` so missing
 * NOTION_API_KEY doesn't crash app boot — first call to any
 * `notionClient.<resource>.<method>(...)` throws `NotConfiguredError` if
 * the env var isn't set.
 *
 */
export const notionClient = lazyProxy(() => new Client({ auth: getNotionConfig().apiKey }))
