import { Client } from '@upstash/qstash'

import { lazyProxy } from '@/shared/config/lazy-proxy'

import { getQstashConfig } from './lib/config'

/**
 * QStash publisher client. Lazy-constructed via `lazyProxy` so missing
 * QSTASH_TOKEN doesn't crash app boot — first call to
 * `qstashClient.publishJSON(...)` (or any other method) throws
 * `NotConfiguredError` if the env var isn't set.
 *
 */
export const qstashClient = lazyProxy(() => new Client({
  baseUrl: 'https://qstash-us-east-1.upstash.io',
  token: getQstashConfig().token,
}))
