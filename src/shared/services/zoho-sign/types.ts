import z from 'zod'

export const zohoRequestStatuses = [
  'draft',
  'inprogress',
  'completed',
  'declined',
  'recalled',
  'expired',
] as const
export type ZohoRequestStatus = (typeof zohoRequestStatuses)[number]

export const zohoActionStatuses = [
  'NOACTION',
  'UNOPENED',
  'VIEWED',
  'SIGNED',
] as const
export type ZohoActionStatus = (typeof zohoActionStatuses)[number]

export interface ZohoSignerStatus {
  role: string
  status: ZohoActionStatus
}

export interface ZohoContractStatus {
  requestId: string
  requestStatus: ZohoRequestStatus
  signerStatuses: ZohoSignerStatus[]
}

/**
 * Webhook payload shape validated against Zoho's ACTUAL payloads (not
 * their docs, which diverge). Confirmed 2026-05-04 via live test webhook.
 *
 * Key differences from docs:
 *   - `request_id` is a number, not string
 *   - `performed_at` is epoch-ms number, not ISO string
 *   - `notifications` is a single object, not an array
 *   - `operation_type` uses actual values like `RequestSigningSuccess`
 *     (docs say `RequestCompleted`)
 */
export const webhookPayloadSchema = z.object({
  requests: z.object({
    request_id: z.coerce.string(),
    request_status: z.string(),
    request_name: z.string().optional(),
  }),
  notifications: z.object({
    operation_type: z.string(),
    performed_at: z.number(),
    performed_by_email: z.string().optional(),
    ip_address: z.string().optional(),
  }),
})
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>
