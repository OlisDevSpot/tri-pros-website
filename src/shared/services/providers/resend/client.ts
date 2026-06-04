import { Resend } from 'resend'

import { lazyProxy } from '@/shared/config/lazy-proxy'

import { getResendConfig } from './lib/config'

/**
 * Resend SDK client. Lazy-constructed on first property access via
 * `lazyProxy` so missing RESEND_API_KEY doesn't crash app boot — only
 * the first call to `resendClient.emails.send(...)` (or any other method)
 * throws `NotConfiguredError` if the env var isn't set.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export const resendClient = lazyProxy(() => new Resend(getResendConfig().apiKey))
