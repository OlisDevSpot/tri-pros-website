import { z } from 'zod'

import { e164Schema, twilioSidSchema } from '../schemas/primitives'

// Inbound messaging webhook payloads. Twilio POSTs these as form-urlencoded;
// every value arrives as a string.
//
// Reference: https://www.twilio.com/docs/messaging/guides/webhook-request

// Status values Twilio emits on the message-status callback. The full lifecycle:
//   accepted → queued → sending → sent → delivered (or undelivered/failed)
//   inbound messages skip queueing and arrive as `received`.
export const messagingStatusSchema = z.enum([
  'accepted',
  'queued',
  'sending',
  'sent',
  'delivered',
  'undelivered',
  'failed',
  'receiving',
  'received',
  'read',
])
export type MessagingStatus = z.infer<typeof messagingStatusSchema>

// Inbound SMS — Twilio hits the IncomingPhoneNumber's messaging URL with this
// shape. We respond with TwiML; the route handler also persists the message.
export const messagingInboundWebhookSchema = z.object({
  MessageSid: twilioSidSchema,
  AccountSid: twilioSidSchema,
  // `From` is the customer; `To` is one of OUR DIDs.
  From: e164Schema,
  To: e164Schema,
  Body: z.string(),
  // Number of media attachments. Twilio also sends MediaUrl0..MediaUrlN +
  // MediaContentType0..N as separate fields when NumMedia > 0; the route
  // handler iterates by index. We don't model the dynamic-keyed fields here.
  NumMedia: z.coerce.number().int().nonnegative(),
})
export type MessagingInboundWebhookPayload = z.infer<typeof messagingInboundWebhookSchema>

// Outbound message status callback. Fires throughout delivery lifecycle when
// `statusCallback` was set on the original send.
export const messagingStatusCallbackSchema = z.object({
  MessageSid: twilioSidSchema,
  AccountSid: twilioSidSchema,
  From: e164Schema,
  To: e164Schema,
  MessageStatus: messagingStatusSchema,
  // ErrorCode is present on `undelivered` / `failed`. Twilio's full list:
  // https://www.twilio.com/docs/api/errors
  ErrorCode: z.coerce.number().int().optional(),
})
export type MessagingStatusCallbackPayload = z.infer<typeof messagingStatusCallbackSchema>
