import type { Twilio } from 'twilio'

import twilio, { RestException as TwilioRestException } from 'twilio'

import serverEnv from '@/shared/config/server-env'

// Lazy singleton — the Twilio SDK reads env at construction. Constructing at
// module-load breaks edge-runtime static probes and test environments where
// env may be partially populated. Lazy means we never instantiate before the
// first real call.

let _client: Twilio | undefined

export function twilioClient(): Twilio {
  if (!_client) {
    _client = twilio(serverEnv.TWILIO_ACCOUNT_SID, serverEnv.TWILIO_AUTH_TOKEN)
  }
  return _client
}

// Re-export RestException so callers can `instanceof RestException` against
// it to access `.code`, `.status`, `.message`, `.moreInfo` without importing
// directly from `twilio` themselves. The provider is the only place that
// imports from the SDK.
export { TwilioRestException as RestException }
