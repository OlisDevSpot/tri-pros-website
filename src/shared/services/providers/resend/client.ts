import type { Resend } from 'resend'

import { lazyAsync } from '@/shared/config/lazy-async'
import env from '@/shared/config/server-env'

import { getResendConfig } from './lib/config'
import { applyDevRecipientOverride } from './lib/dev-recipients'

/**
 * Resend SDK client, loaded and constructed on the first send. The SDK brings
 * mail-parsing dependencies (mailparser → libmime, iconv-lite) and webhook
 * signing (svix) that no page render needs; a static import compiles them on
 * every cold start of every route that imports the app router. A missing
 * RESEND_API_KEY rejects the first send with `NotConfiguredError` instead of
 * crashing app boot.
 */
function createResendClient() {
  const sdk = lazyAsync(async (): Promise<Resend> => {
    const { Resend } = await import('resend')
    return new Resend(getResendConfig().apiKey)
  })

  return {
    emails: {
      async send(...args: Parameters<Resend['emails']['send']>) {
        const [payload, options] = args
        const guarded = applyDevRecipientOverride(payload, {
          isProduction: env.VERCEL_ENV === 'production',
          override: getResendConfig().devRecipientOverride,
        })
        return (await sdk()).emails.send(guarded, options)
      },
    },
  }
}

export type ResendClient = ReturnType<typeof createResendClient>

export const resendClient = createResendClient()
