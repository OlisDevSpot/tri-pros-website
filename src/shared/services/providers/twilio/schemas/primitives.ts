import { z } from 'zod'

// Shared Zod primitives used across the Twilio provider. Wire shapes only —
// no domain types. Schemas describe what Twilio sends us, not what our app
// thinks about it.

// E.164: leading + then 1-15 digits. Twilio accepts only E.164 on REST + emits
// E.164 in webhooks. Strict regex catches the common "(424) 555-..." mistake.
export const e164Schema = z.string().regex(/^\+[1-9]\d{1,14}$/, {
  message: 'Must be E.164 (e.g., +14245551234)',
})
export type E164 = z.infer<typeof e164Schema>

// Twilio SID prefix + 32 hex chars. Branch by prefix at the call site if you
// need to disambiguate Call / Message / Account / etc. SIDs.
export const twilioSidSchema = z.string().regex(/^[A-Z]{2}[a-f0-9]{32}$/i, {
  message: 'Must be a Twilio SID (e.g., CA[32-hex])',
})
export type TwilioSid = z.infer<typeof twilioSidSchema>

// Twilio webhooks emit ISO 8601 UTC. Most webhook payloads omit timestamps
// (they're inferred from delivery time) but where they ARE present, parse strict.
export const isoDateTimeSchema = z.iso.datetime()
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>
