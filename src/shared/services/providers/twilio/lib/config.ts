import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Twilio env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Notes:
 * - `TWILIO_TRUST_PROFILE_SID` and `TWILIO_10DLC_CAMPAIGN_SID` are vetting-
 *   clock vars. They live on the fragment for visibility but are
 *   intentionally excluded from `TwilioRuntimeConfig` — the SDK + signature-
 *   verify paths don't structurally require them. Read them via the lazy
 *   `getVetting()` helper in `constants/index.ts` when runtime gates need them.
 * - ESM bootstrap order: server-env imports this file for the fragment; the
 *   factory does NOT import server-env back (it validates this fragment against
 *   `process.env` directly), so there is no module-init cycle. See
 *   create-provider-config.ts for the full rationale.
 */
export const twilioEnvFragment = z.object({
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_TWIML_APP_SID: z.string().optional(),
  TWILIO_TRUST_PROFILE_SID: z.string().optional(), // vetting clock; optional until Trust Hub approves
  TWILIO_10DLC_CAMPAIGN_SID: z.string().optional(), // vetting clock; optional until 10DLC approves
})

export type ParsedTwilioEnv = z.infer<typeof twilioEnvFragment>

export interface TwilioRuntimeConfig {
  accountSid: string
  authToken: string
  apiKeySid: string
  apiKeySecret: string
  twimlAppSid: string
}

const helpers = createProviderConfig({
  provider: 'twilio',
  fragment: twilioEnvFragment,
  requiredKeys: [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_API_KEY_SID',
    'TWILIO_API_KEY_SECRET',
    'TWILIO_TWIML_APP_SID',
  ],
  toConfig: (parsed): TwilioRuntimeConfig => ({
    accountSid: parsed.TWILIO_ACCOUNT_SID!,
    authToken: parsed.TWILIO_AUTH_TOKEN!,
    apiKeySid: parsed.TWILIO_API_KEY_SID!,
    apiKeySecret: parsed.TWILIO_API_KEY_SECRET!,
    twimlAppSid: parsed.TWILIO_TWIML_APP_SID!,
  }),
})

export const buildTwilioConfig = helpers.build
export const getTwilioConfig = helpers.get
export const isTwilioConfigured = helpers.isConfigured
export const twilioConfigMeta = helpers.configMeta
