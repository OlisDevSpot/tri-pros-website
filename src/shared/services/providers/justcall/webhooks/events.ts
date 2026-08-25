import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

// JustCall inbound webhook shapes (the subset consumed at go-live). Verified
// against developer.justcall.io (call-events, sms-events, dynamic-webhook-
// signatures) 2026-08-19. Every JustCall webhook shares one envelope:
//   { request_id, webhook_url, url_id, type, data: { … } }
// `type` + `webhook_url` sit at the root (both feed the signature); everything
// payload-shaped lives under `data`.
//
// Disposition split: JustCall may deliver the final disposition on
// `sd.call_updated` rather than `sd.call_completed`, so the adapter keys the
// unenroll decision off `*_updated` (when a disposition is present) and the SMS
// cadence off `*_completed`.

// Shared `data` shape for Sales Dialer call events. The dialed DID the contact
// sees is `sales_dialer_number` (→ the SMS `from`); disposition/direction nest
// under `call_info`; `contact_id` is JustCall's numeric contact id.
const jcCallDataSchema = z.object({
  call_sid: z.string(),
  contact_id: z.union([z.string(), z.number()]).transform(String).optional(),
  contact_number: z.string().optional(),
  sales_dialer_number: z.string().optional(),
  call_info: z
    .object({
      direction: z.string().optional(),
      disposition: z.string().nullable().optional(),
    })
    .optional(),
})

export const jcCallCompletedSchema = z.object({
  type: z.literal('sd.call_completed'),
  webhook_url: z.string().optional(),
  data: jcCallDataSchema,
})

export const jcCallUpdatedSchema = z.object({
  type: z.literal('sd.call_updated'),
  webhook_url: z.string().optional(),
  data: jcCallDataSchema,
})

export const jcSmsReceivedSchema = z.object({
  type: z.literal('sms.received'),
  webhook_url: z.string().optional(),
  data: z.object({
    contact_number: z.string(),
    justcall_number: z.string(),
    direction: z.string().optional(),
    sms_info: z.object({ body: z.string() }),
    contact_id: z.union([z.string(), z.number()]).transform(String).optional(),
  }),
})

export const jcWebhookEventSchema = z.discriminatedUnion('type', [
  jcCallCompletedSchema,
  jcCallUpdatedSchema,
  jcSmsReceivedSchema,
])
export type JcWebhookEvent = z.infer<typeof jcWebhookEventSchema>

/**
 * Verify a JustCall webhook signature. Verified recipe (developer.justcall.io
 * /docs/dynamic-webhook-signatures, 2026-08-19): HMAC-SHA256 (hex), keyed with
 * the API secret, over `{secret}|{encodeURIComponent(webhook_url)}|{type}|{timestamp}`.
 * The secret is BOTH the HMAC key and the first pipe field. `webhook_url` + `type`
 * come from the request BODY; `timestamp` from the `x-justcall-request-timestamp`
 * header. Constant-time compared; false on any mismatch/length diff → route 401s.
 */
export function verifyJustcallSignature(input: {
  secret: string
  webhookUrl: string
  eventType: string
  timestamp: string
  signature: string
}): boolean {
  const signed = `${input.secret}|${encodeURIComponent(input.webhookUrl)}|${input.eventType}|${input.timestamp}`
  const expected = createHmac('sha256', input.secret).update(signed).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(input.signature)
  if (a.length !== b.length) {
    return false
  }
  try {
    return timingSafeEqual(a, b)
  }
  catch {
    return false
  }
}
