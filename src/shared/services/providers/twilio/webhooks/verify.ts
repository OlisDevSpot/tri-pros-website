import twilio from 'twilio'

import serverEnv from '@/shared/config/server-env'

// Webhook signature verification. Twilio signs every webhook with HMAC-SHA1
// over (url + sorted-form-params) using the account's auth token. The SDK's
// `validateRequest` does the HMAC + constant-time compare.

interface VerifyTwilioSignatureInput {
  // Full URL Twilio was configured to call, INCLUDING any query string.
  // Must match exactly — a trailing slash mismatch or missing query string
  // will fail validation. The caller (route handler) reconstructs from
  // request headers.
  url: string
  // Value of the X-Twilio-Signature request header. Twilio sets it on every
  // webhook delivery; absence means the request did not come from Twilio.
  signature: string
  // Form-urlencoded body parsed into a record. Twilio webhooks are
  // form-urlencoded by default; values are always strings.
  params: Record<string, string>
}

export function verifyTwilioSignature(input: VerifyTwilioSignatureInput): boolean {
  return twilio.validateRequest(
    serverEnv.TWILIO_AUTH_TOKEN,
    input.signature,
    input.url,
    input.params,
  )
}
